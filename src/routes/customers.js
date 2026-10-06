const express = require('express');
const { pool } = require('../db');
const { AppError } = require('../errorHandler');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();

/**
 * GET /api/customers
 * List customers (Requires authentication: CUSTOMER sees only self; OWNER sees customers)
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { search } = req.query;
    let query = 'SELECT * FROM customer';
    const params = [];
    const where = [];

    // If customer, only see own profile
    if (req.user.role === 'CUSTOMER') {
      where.push('Customer_ID = ?');
      params.push(req.user.customer_id);
    }

    if (search) {
      where.push('(Customer_Name LIKE ? OR Email LIKE ? OR Phone_Number LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (where.length > 0) {
      query += ` WHERE ${where.join(' AND ')}`;
    }

    query += ' ORDER BY Customer_ID ASC';

    const [rows] = await pool.query(query, params);
    res.json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/customers/:id
 * Get single customer by ID (CUSTOMER can only view self)
 */
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    // CUSTOMER role can only access their own profile
    if (req.user.role === 'CUSTOMER' && parseInt(id, 10) !== req.user.customer_id) {
      throw new AppError('Forbidden: You can only view your own customer profile', 403);
    }

    const [rows] = await pool.query(
      'SELECT * FROM customer WHERE Customer_ID = ?',
      [id]
    );

    if (rows.length === 0) {
      throw AppError.notFound(`Customer with ID ${id} not found`);
    }

    const customer = rows[0];

    // Fetch recent bookings for customer
    const [bookings] = await pool.query(
      `SELECT b.Booking_ID, b.Booking_Date, b.Start_Time, b.End_Time, b.Booking_Status, 
              cp.Charger_ID, cp.Charger_Type, cs.Station_Name 
       FROM booking b
       JOIN charging_point cp ON b.Charger_ID = cp.Charger_ID
       JOIN charging_station cs ON cp.Station_ID = cs.Station_ID
       WHERE b.Customer_ID = ?
       ORDER BY b.Booking_Date DESC, b.Start_Time DESC
       LIMIT 10`,
      [id]
    );

    customer.recent_bookings = bookings;

    res.json({
      success: true,
      data: customer
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/customers
 * Create a new customer record (Requires authentication)
 */
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { Customer_Name, Phone_Number, Email, Address } = req.body;

    if (!Customer_Name) {
      throw AppError.badRequest('Customer_Name is required');
    }

    const [result] = await pool.query(
      `INSERT INTO customer (Customer_Name, Phone_Number, Email, Address) 
       VALUES (?, ?, ?, ?)`,
      [Customer_Name, Phone_Number || null, Email || null, Address || null]
    );

    const [newCustomer] = await pool.query(
      'SELECT * FROM customer WHERE Customer_ID = ?',
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      data: newCustomer[0]
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/customers/:id
 * Update customer details (CUSTOMER can only edit own profile)
 */
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { Customer_Name, Phone_Number, Email, Address } = req.body;

    // CUSTOMER role can only edit their own profile
    if (req.user.role === 'CUSTOMER' && parseInt(id, 10) !== req.user.customer_id) {
      throw new AppError('Forbidden: You can only edit your own profile', 403);
    }

    const [existing] = await pool.query(
      'SELECT * FROM customer WHERE Customer_ID = ?',
      [id]
    );

    if (existing.length === 0) {
      throw AppError.notFound(`Customer with ID ${id} not found`);
    }

    const current = existing[0];
    const updatedName = Customer_Name !== undefined ? Customer_Name : current.Customer_Name;
    const updatedPhone = Phone_Number !== undefined ? Phone_Number : current.Phone_Number;
    const updatedEmail = Email !== undefined ? Email : current.Email;
    const updatedAddress = Address !== undefined ? Address : current.Address;

    await pool.query(
      `UPDATE customer 
       SET Customer_Name = ?, Phone_Number = ?, Email = ?, Address = ? 
       WHERE Customer_ID = ?`,
      [updatedName, updatedPhone, updatedEmail, updatedAddress, id]
    );

    const [updatedRows] = await pool.query(
      'SELECT * FROM customer WHERE Customer_ID = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Customer updated successfully',
      data: updatedRows[0]
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/customers/:id
 * Delete a customer (CUSTOMER can only delete own account)
 */
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    if (req.user.role === 'CUSTOMER' && parseInt(id, 10) !== req.user.customer_id) {
      throw new AppError('Forbidden: You can only delete your own profile', 403);
    }

    const [existing] = await pool.query(
      'SELECT * FROM customer WHERE Customer_ID = ?',
      [id]
    );

    if (existing.length === 0) {
      throw AppError.notFound(`Customer with ID ${id} not found`);
    }

    await pool.query('DELETE FROM customer WHERE Customer_ID = ?', [id]);

    res.json({
      success: true,
      message: `Customer with ID ${id} deleted successfully`
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
