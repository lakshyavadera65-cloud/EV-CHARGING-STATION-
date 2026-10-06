const express = require('express');
const { pool } = require('../db');
const { AppError } = require('../errorHandler');
const { requireAuth } = require('../auth');

const router = express.Router();

// All payment operations require authentication
router.use(requireAuth);

/**
 * Format Date to YYYY-MM-DD
 * @param {Date} [date]
 * @returns {string}
 */
function toMysqlDate(date = new Date()) {
  const d = new Date(date);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * GET /api/payments
 * List payments:
 * - CUSTOMER sees only their own payments
 * - OWNER sees payments for their own stations
 */
router.get('/', async (req, res, next) => {
  try {
    const { status, method, customer_id, station_id } = req.query;

    let query = `
      SELECT 
        p.Payment_ID,
        p.Payment_Date,
        p.Amount,
        p.Payment_Method,
        p.Payment_Status,
        p.Session_ID,
        cs.Session_Start,
        cs.Session_End,
        cs.Energy_Consumed,
        cs.Charging_Cost,
        b.Booking_ID,
        c.Customer_ID,
        c.Customer_Name,
        st.Station_ID,
        st.Station_Name,
        st.Owner_User_ID
      FROM payment p
      JOIN charging_session cs ON p.Session_ID = cs.Session_ID
      JOIN booking b ON cs.Booking_ID = b.Booking_ID
      JOIN customer c ON b.Customer_ID = c.Customer_ID
      JOIN charging_point cp ON b.Charger_ID = cp.Charger_ID
      JOIN charging_station st ON cp.Station_ID = st.Station_ID
    `;

    const params = [];
    const where = [];

    // Role-based filtering
    if (req.user.role === 'CUSTOMER') {
      where.push('c.Customer_ID = ?');
      params.push(req.user.customer_id);
    } else if (req.user.role === 'OWNER') {
      where.push('(st.Owner_User_ID = ? OR st.Owner_User_ID IS NULL)');
      params.push(req.user.id);
    }

    if (status) {
      where.push('p.Payment_Status = ?');
      params.push(status);
    }

    if (method) {
      where.push('p.Payment_Method = ?');
      params.push(method);
    }

    if (customer_id && req.user.role === 'OWNER') {
      where.push('c.Customer_ID = ?');
      params.push(customer_id);
    }

    if (station_id) {
      where.push('st.Station_ID = ?');
      params.push(station_id);
    }

    if (where.length > 0) {
      query += ` WHERE ${where.join(' AND ')}`;
    }

    query += ' ORDER BY p.Payment_Date DESC, p.Payment_ID DESC';

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
 * GET /api/payments/:id
 * Get single payment by ID (CUSTOMER sees own; OWNER sees own station)
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        p.Payment_ID,
        p.Payment_Date,
        p.Amount,
        p.Payment_Method,
        p.Payment_Status,
        p.Session_ID,
        cs.Session_Start,
        cs.Session_End,
        cs.Energy_Consumed,
        cs.Charging_Cost,
        b.Booking_ID,
        c.Customer_ID,
        c.Customer_Name,
        c.Email AS Customer_Email,
        cp.Charger_ID,
        cp.Charger_Type,
        st.Station_ID,
        st.Station_Name,
        st.Location AS Station_Location,
        st.Owner_User_ID
      FROM payment p
      JOIN charging_session cs ON p.Session_ID = cs.Session_ID
      JOIN booking b ON cs.Booking_ID = b.Booking_ID
      JOIN customer c ON b.Customer_ID = c.Customer_ID
      JOIN charging_point cp ON b.Charger_ID = cp.Charger_ID
      JOIN charging_station st ON cp.Station_ID = st.Station_ID
      WHERE p.Payment_ID = ?
    `;

    const [rows] = await pool.query(query, [id]);
    if (rows.length === 0) {
      throw AppError.notFound(`Payment with ID ${id} not found`);
    }

    const payment = rows[0];

    // Authorization checks
    if (req.user.role === 'CUSTOMER' && payment.Customer_ID !== req.user.customer_id) {
      throw new AppError('Forbidden: You can only view your own payments', 403);
    }

    if (req.user.role === 'OWNER' && payment.Owner_User_ID && payment.Owner_User_ID !== req.user.id) {
      throw new AppError('Forbidden: You can only view payments for stations you own', 403);
    }

    res.json({
      success: true,
      data: payment
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/payments
 * Record a payment for a finished charging session.
 * CUSTOMER can only pay for their own session.
 */
router.post('/', async (req, res, next) => {
  try {
    const { Session_ID, Payment_Method, Payment_Date, Payment_Status, Amount } = req.body;

    if (!Session_ID) {
      throw AppError.badRequest('Session_ID is required to process payment');
    }

    // 1. Fetch charging session and customer ownership
    const [sessionRows] = await pool.query(
      `SELECT cs.*, b.Customer_ID, c.Customer_Name, st.Owner_User_ID 
       FROM charging_session cs
       JOIN booking b ON cs.Booking_ID = b.Booking_ID
       JOIN customer c ON b.Customer_ID = c.Customer_ID
       JOIN charging_point cp ON b.Charger_ID = cp.Charger_ID
       JOIN charging_station st ON cp.Station_ID = st.Station_ID
       WHERE cs.Session_ID = ?`,
      [Session_ID]
    );

    if (sessionRows.length === 0) {
      throw AppError.notFound(`Charging session with ID ${Session_ID} not found`);
    }

    const session = sessionRows[0];

    // Ownership check: CUSTOMER can only pay for their own session
    if (req.user.role === 'CUSTOMER' && session.Customer_ID !== req.user.customer_id) {
      throw new AppError('Forbidden: You can only make payments for your own charging sessions', 403);
    }

    // 2. Validate session is finished
    if (!session.Session_End || session.Charging_Cost === null) {
      throw AppError.badRequest(
        `Cannot record payment: Charging session ${Session_ID} is still in progress. End the session first.`
      );
    }

    // 3. Enforce one payment per session
    const [existingPayments] = await pool.query(
      'SELECT Payment_ID, Amount, Payment_Status, Payment_Date FROM payment WHERE Session_ID = ?',
      [Session_ID]
    );

    if (existingPayments.length > 0) {
      const existing = existingPayments[0];
      throw AppError.conflict(
        `Payment already processed for Session ${Session_ID} (Payment ID: ${existing.Payment_ID}, Amount: ${existing.Amount}, Status: ${existing.Payment_Status})`
      );
    }

    // 4. Use session's Charging_Cost or provided amount
    const payAmount = Amount !== undefined && Amount !== null ? parseFloat(Amount) : parseFloat(session.Charging_Cost);
    const payDate = Payment_Date || toMysqlDate();
    const payMethod = Payment_Method || 'UPI';
    const payStatus = Payment_Status || 'Paid';

    if (isNaN(payAmount) || payAmount < 0) {
      throw AppError.badRequest('Invalid payment amount');
    }

    // 5. Insert payment
    const [result] = await pool.query(
      `INSERT INTO payment (Payment_Date, Amount, Payment_Method, Payment_Status, Session_ID) 
       VALUES (?, ?, ?, ?, ?)`,
      [payDate, payAmount, payMethod, payStatus, Session_ID]
    );

    // Fetch created payment with joins
    const [newPayment] = await pool.query(
      `SELECT 
        p.*, 
        c.Customer_Name, 
        cs.Charging_Cost AS Expected_Cost, 
        cs.Energy_Consumed 
       FROM payment p 
       JOIN charging_session cs ON p.Session_ID = cs.Session_ID 
       JOIN booking b ON cs.Booking_ID = b.Booking_ID 
       JOIN customer c ON b.Customer_ID = c.Customer_ID 
       WHERE p.Payment_ID = ?`,
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: 'Payment recorded successfully',
      data: newPayment[0]
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/payments/:id
 * Delete a payment (administrative)
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const [existing] = await pool.query(
      `SELECT p.*, c.Customer_ID, st.Owner_User_ID 
       FROM payment p
       JOIN charging_session cs ON p.Session_ID = cs.Session_ID
       JOIN booking b ON cs.Booking_ID = b.Booking_ID
       JOIN customer c ON b.Customer_ID = c.Customer_ID
       JOIN charging_point cp ON b.Charger_ID = cp.Charger_ID
       JOIN charging_station st ON cp.Station_ID = st.Station_ID
       WHERE p.Payment_ID = ?`,
      [id]
    );

    if (existing.length === 0) {
      throw AppError.notFound(`Payment with ID ${id} not found`);
    }

    const payment = existing[0];
    if (req.user.role === 'CUSTOMER' && payment.Customer_ID !== req.user.customer_id) {
      throw new AppError('Forbidden: You can only delete your own payments', 403);
    }
    if (req.user.role === 'OWNER' && payment.Owner_User_ID && payment.Owner_User_ID !== req.user.id) {
      throw new AppError('Forbidden: You can only delete payments for stations you own', 403);
    }

    await pool.query('DELETE FROM payment WHERE Payment_ID = ?', [id]);

    res.json({
      success: true,
      message: `Payment with ID ${id} deleted successfully`
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
