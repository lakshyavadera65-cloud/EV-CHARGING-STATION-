const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { pool } = require('../db');
const { AppError } = require('../errorHandler');
const { generateToken, requireAuth } = require('../auth');

const router = express.Router();

// Rate limiter for authentication endpoints (prevent brute-force attacks)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: {
        status: 429,
        message: 'Too many authentication attempts, please try again after 15 minutes.'
      }
    });
  }
});

/**
 * Helper to validate email format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return typeof email === 'string' && emailRegex.test(email.trim());
}

/**
 * POST /api/auth/register/customer
 * Registers a new customer and creates a linked user_account with Role 'CUSTOMER'
 */
router.post('/register/customer', authLimiter, async (req, res, next) => {
  const connection = await pool.getConnection();

  try {
    const { name, email, phone, address, password } = req.body;

    // 1. Validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw AppError.badRequest('Name is required');
    }

    if (!email || !isValidEmail(email)) {
      throw AppError.badRequest('A valid email address is required');
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      throw AppError.badRequest('Password must be at least 8 characters long');
    }

    const cleanEmail = email.trim().toLowerCase();

    await connection.beginTransaction();

    // 2. Check if email already registered in user_account
    const [existingUsers] = await connection.query(
      'SELECT User_ID FROM user_account WHERE Email = ?',
      [cleanEmail]
    );

    if (existingUsers.length > 0) {
      throw AppError.conflict('An account with this email already exists');
    }

    // 3. Create or find Customer record
    const [existingCustomers] = await connection.query(
      'SELECT Customer_ID FROM customer WHERE Email = ?',
      [cleanEmail]
    );

    let customerId;
    if (existingCustomers.length > 0) {
      customerId = existingCustomers[0].Customer_ID;
    } else {
      const [customerResult] = await connection.query(
        'INSERT INTO customer (Customer_Name, Phone_Number, Email, Address) VALUES (?, ?, ?, ?)',
        [name.trim(), phone || null, cleanEmail, address || null]
      );
      customerId = customerResult.insertId;
    }

    // 4. Hash password with bcrypt
    const passwordHash = await bcrypt.hash(password, 10);

    // 5. Create user_account (Role is always CUSTOMER, never from client body)
    const [userResult] = await connection.query(
      `INSERT INTO user_account (Email, Password_Hash, Role, Customer_ID, Phone_Number) 
       VALUES (?, ?, 'CUSTOMER', ?, ?)`,
      [cleanEmail, passwordHash, customerId, phone || null]
    );

    await connection.commit();

    const newUserId = userResult.insertId;
    const token = generateToken({
      User_ID: newUserId,
      Email: cleanEmail,
      Role: 'CUSTOMER',
      Customer_ID: customerId
    });

    res.status(201).json({
      success: true,
      message: 'Customer registered successfully',
      token,
      user: {
        id: newUserId,
        email: cleanEmail,
        role: 'CUSTOMER',
        name: name.trim(),
        customer_id: customerId
      }
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

/**
 * POST /api/auth/register/owner
 * Registers a charging station owner account with Role 'OWNER'
 */
router.post('/register/owner', authLimiter, async (req, res, next) => {
  try {
    const { name, email, phone, password } = req.body;

    // 1. Validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw AppError.badRequest('Owner name is required');
    }

    if (!email || !isValidEmail(email)) {
      throw AppError.badRequest('A valid email address is required');
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      throw AppError.badRequest('Password must be at least 8 characters long');
    }

    const cleanEmail = email.trim().toLowerCase();

    // 2. Check if email already registered
    const [existingUsers] = await pool.query(
      'SELECT User_ID FROM user_account WHERE Email = ?',
      [cleanEmail]
    );

    if (existingUsers.length > 0) {
      throw AppError.conflict('An account with this email already exists');
    }

    // 3. Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // 4. Create user_account (Role is always OWNER, never from client body)
    const [result] = await pool.query(
      `INSERT INTO user_account (Email, Password_Hash, Role, Owner_Name, Phone_Number) 
       VALUES (?, ?, 'OWNER', ?, ?)`,
      [cleanEmail, passwordHash, name.trim(), phone || null]
    );

    const newUserId = result.insertId;
    const token = generateToken({
      User_ID: newUserId,
      Email: cleanEmail,
      Role: 'OWNER',
      Customer_ID: null
    });

    res.status(201).json({
      success: true,
      message: 'Owner registered successfully',
      token,
      user: {
        id: newUserId,
        email: cleanEmail,
        role: 'OWNER',
        name: name.trim(),
        customer_id: null
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/login
 * Authenticates user and returns JWT token
 */
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw AppError.badRequest('Email and password are required');
    }

    const cleanEmail = email.trim().toLowerCase();

    // Fetch user and linked customer name if role is CUSTOMER
    const [rows] = await pool.query(
      `SELECT u.User_ID, u.Email, u.Password_Hash, u.Role, u.Customer_ID, u.Owner_Name, u.Phone_Number, c.Customer_Name 
       FROM user_account u
       LEFT JOIN customer c ON u.Customer_ID = c.Customer_ID
       WHERE u.Email = ?`,
      [cleanEmail]
    );

    if (rows.length === 0) {
      throw new AppError('Invalid email or password', 401);
    }

    const user = rows[0];

    // Verify password
    const isMatch = await bcrypt.compare(password, user.Password_Hash);
    if (!isMatch) {
      throw new AppError('Invalid email or password', 401);
    }

    const token = generateToken(user);

    const displayName = user.Role === 'CUSTOMER' ? user.Customer_Name : user.Owner_Name;

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.User_ID,
        email: user.Email,
        role: user.Role,
        name: displayName,
        customer_id: user.Customer_ID
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/me
 * Returns current authenticated user profile
 */
router.get('/me', requireAuth, async (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

module.exports = router;
