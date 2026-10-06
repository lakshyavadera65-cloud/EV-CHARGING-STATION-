const jwt = require('jsonwebtoken');
const { pool } = require('./db');
const { AppError } = require('./errorHandler');

const JWT_SECRET = process.env.JWT_SECRET || 'ev_charging_station_super_secret_jwt_key_2026_x99!';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Generate a signed JWT for a user
 * @param {Object} user 
 * @returns {string} token
 */
function generateToken(user) {
  return jwt.sign(
    {
      id: user.User_ID || user.id,
      email: user.Email || user.email,
      role: user.Role || user.role,
      customer_id: user.Customer_ID || user.customer_id || null
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Middleware: requireAuth
 * Enforces valid JWT token in Authorization: Bearer <token>
 * Returns 401 if missing, invalid, or expired
 */
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication required. Missing or malformed token.', 401);
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new AppError('Authentication required. Missing token.', 401);
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new AppError('Authentication failed: Token has expired.', 401);
      }
      throw new AppError('Authentication failed: Invalid token.', 401);
    }

    // Fetch fresh user data from database to ensure account is active and role is fresh
    const [rows] = await pool.query(
      `SELECT u.User_ID, u.Email, u.Role, u.Customer_ID, u.Owner_Name, u.Phone_Number, c.Customer_Name 
       FROM user_account u
       LEFT JOIN customer c ON u.Customer_ID = c.Customer_ID
       WHERE u.User_ID = ?`,
      [decoded.id]
    );

    if (rows.length === 0) {
      throw new AppError('Authentication failed: User account no longer exists.', 401);
    }

    const userRow = rows[0];
    req.user = {
      id: userRow.User_ID,
      email: userRow.Email,
      role: userRow.Role,
      customer_id: userRow.Customer_ID,
      name: userRow.Role === 'CUSTOMER' ? userRow.Customer_Name : userRow.Owner_Name,
      phone: userRow.Phone_Number
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware: optionalAuth
 * Parses Bearer token if provided, but allows unauthenticated requests
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      req.user = null;
      return next();
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const [rows] = await pool.query(
        `SELECT u.User_ID, u.Email, u.Role, u.Customer_ID, u.Owner_Name, u.Phone_Number, c.Customer_Name 
         FROM user_account u
         LEFT JOIN customer c ON u.Customer_ID = c.Customer_ID
         WHERE u.User_ID = ?`,
        [decoded.id]
      );

      if (rows.length > 0) {
        const userRow = rows[0];
        req.user = {
          id: userRow.User_ID,
          email: userRow.Email,
          role: userRow.Role,
          customer_id: userRow.Customer_ID,
          name: userRow.Role === 'CUSTOMER' ? userRow.Customer_Name : userRow.Owner_Name,
          phone: userRow.Phone_Number
        };
      } else {
        req.user = null;
      }
    } catch {
      req.user = null;
    }

    next();
  } catch {
    req.user = null;
    next();
  }
}

/**
 * Middleware: requireRole
 * Requires req.user to have one of the specified roles
 * Returns 403 Forbidden if role does not match
 * @param  {...string} roles e.g. 'CUSTOMER', 'OWNER'
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required.', 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new AppError(
          `Forbidden: Access denied. Role '${req.user.role}' is not authorized to access this resource.`,
          403
        )
      );
    }

    next();
  };
}

module.exports = {
  generateToken,
  requireAuth,
  optionalAuth,
  requireRole
};
