const express = require('express');
const { pool } = require('../db');
const { AppError } = require('../errorHandler');
const { requireAuth } = require('../auth');

const router = express.Router();

// All booking operations require authentication
router.use(requireAuth);

/**
 * Helper to normalize time string to HH:MM:SS format
 * @param {string} timeStr 
 * @returns {string}
 */
function normalizeTime(timeStr) {
  if (!timeStr) return '';
  const parts = timeStr.trim().split(':');
  if (parts.length === 2) {
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:00`;
  }
  if (parts.length === 3) {
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:${parts[2].padStart(2, '0')}`;
  }
  return timeStr;
}

/**
 * GET /api/bookings
 * List bookings:
 * - CUSTOMER sees only their own bookings
 * - OWNER sees bookings at their own stations
 */
router.get('/', async (req, res, next) => {
  try {
    const { date, status, customer_id, charger_id, station_id } = req.query;

    let query = `
      SELECT 
        b.Booking_ID,
        b.Booking_Date,
        b.Start_Time,
        b.End_Time,
        b.Booking_Status,
        b.Customer_ID,
        c.Customer_Name,
        c.Phone_Number AS Customer_Phone,
        c.Email AS Customer_Email,
        b.Charger_ID,
        cp.Charger_Type,
        cp.Connector_Type,
        cp.Power_Output,
        cp.Availability_Status AS Charger_Availability,
        cs.Station_ID,
        cs.Station_Name,
        cs.Location AS Station_Location,
        cs.Owner_User_ID,
        sess.Session_ID,
        sess.Charging_Cost
      FROM booking b
      JOIN customer c ON b.Customer_ID = c.Customer_ID
      JOIN charging_point cp ON b.Charger_ID = cp.Charger_ID
      JOIN charging_station cs ON cp.Station_ID = cs.Station_ID
      LEFT JOIN charging_session sess ON b.Booking_ID = sess.Booking_ID
    `;

    const params = [];
    const where = [];

    // Role-based visibility
    if (req.user.role === 'CUSTOMER') {
      where.push('b.Customer_ID = ?');
      params.push(req.user.customer_id);
    } else if (req.user.role === 'OWNER') {
      where.push('(cs.Owner_User_ID = ? OR cs.Owner_User_ID IS NULL)');
      params.push(req.user.id);
    }

    if (date) {
      where.push('b.Booking_Date = ?');
      params.push(date);
    }

    if (status) {
      where.push('b.Booking_Status = ?');
      params.push(status);
    }

    if (customer_id && req.user.role === 'OWNER') {
      where.push('b.Customer_ID = ?');
      params.push(customer_id);
    }

    if (charger_id) {
      where.push('b.Charger_ID = ?');
      params.push(charger_id);
    }

    if (station_id) {
      where.push('cs.Station_ID = ?');
      params.push(station_id);
    }

    if (where.length > 0) {
      query += ` WHERE ${where.join(' AND ')}`;
    }

    query += ' ORDER BY b.Booking_Date DESC, b.Start_Time DESC';

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
 * GET /api/bookings/:id
 * Get single booking (CUSTOMER can only view self; OWNER can only view own station)
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        b.Booking_ID,
        b.Booking_Date,
        b.Start_Time,
        b.End_Time,
        b.Booking_Status,
        b.Customer_ID,
        c.Customer_Name,
        c.Phone_Number AS Customer_Phone,
        c.Email AS Customer_Email,
        b.Charger_ID,
        cp.Charger_Type,
        cp.Connector_Type,
        cp.Power_Output,
        cp.Availability_Status AS Charger_Availability,
        cs.Station_ID,
        cs.Station_Name,
        cs.Location AS Station_Location,
        cs.Owner_User_ID,
        sess.Session_ID,
        sess.Session_Start,
        sess.Session_End,
        sess.Energy_Consumed,
        sess.Charging_Cost
      FROM booking b
      JOIN customer c ON b.Customer_ID = c.Customer_ID
      JOIN charging_point cp ON b.Charger_ID = cp.Charger_ID
      JOIN charging_station cs ON cp.Station_ID = cs.Station_ID
      LEFT JOIN charging_session sess ON b.Booking_ID = sess.Booking_ID
      WHERE b.Booking_ID = ?
    `;

    const [rows] = await pool.query(query, [id]);
    if (rows.length === 0) {
      throw AppError.notFound(`Booking with ID ${id} not found`);
    }

    const booking = rows[0];

    // Authorization check
    if (req.user.role === 'CUSTOMER' && booking.Customer_ID !== req.user.customer_id) {
      throw new AppError('Forbidden: You can only view your own bookings', 403);
    }

    if (req.user.role === 'OWNER' && booking.Owner_User_ID && booking.Owner_User_ID !== req.user.id) {
      throw new AppError('Forbidden: You can only view bookings for stations you own', 403);
    }

    res.json({
      success: true,
      data: booking
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/bookings
 * Create booking with validations (CUSTOMER can only book for themselves)
 */
router.post('/', async (req, res, next) => {
  try {
    const { Booking_Date, Start_Time, End_Time, Customer_ID, Charger_ID, Booking_Status } = req.body;

    // CUSTOMER role can only book for themselves
    let targetCustomerId = Customer_ID;
    if (req.user.role === 'CUSTOMER') {
      if (Customer_ID && parseInt(Customer_ID, 10) !== req.user.customer_id) {
        throw new AppError('Forbidden: You can only create bookings for yourself', 403);
      }
      targetCustomerId = req.user.customer_id;
    } else if (!targetCustomerId) {
      throw AppError.badRequest('Customer_ID is required');
    }

    // 1. Check required fields
    if (!Booking_Date || !Start_Time || !End_Time || !targetCustomerId || !Charger_ID) {
      throw AppError.badRequest('Booking_Date, Start_Time, End_Time, Customer_ID, and Charger_ID are required');
    }

    const normStartTime = normalizeTime(Start_Time);
    const normEndTime = normalizeTime(End_Time);

    // 2. Validate End_Time > Start_Time
    if (normEndTime <= normStartTime) {
      throw AppError.badRequest(`End_Time (${normEndTime}) must be after Start_Time (${normStartTime})`);
    }

    // 3. Verify Customer exists
    const [customerRows] = await pool.query(
      'SELECT Customer_ID, Customer_Name FROM customer WHERE Customer_ID = ?',
      [targetCustomerId]
    );
    if (customerRows.length === 0) {
      throw AppError.badRequest(`Customer with ID ${targetCustomerId} does not exist`);
    }

    // 4. Verify Charger exists and is NOT under maintenance
    const [chargerRows] = await pool.query(
      'SELECT Charger_ID, Availability_Status, Station_ID FROM charging_point WHERE Charger_ID = ?',
      [Charger_ID]
    );
    if (chargerRows.length === 0) {
      throw AppError.notFound(`Charger with ID ${Charger_ID} does not exist`);
    }

    const charger = chargerRows[0];
    if (charger.Availability_Status === 'Maintenance') {
      throw AppError.badRequest(
        `Charger ${Charger_ID} is currently under maintenance and cannot be booked`
      );
    }

    // 5. Check overlapping bookings on the same charger and date (ignoring Cancelled bookings)
    const overlapSql = `
      SELECT Booking_ID, Start_Time, End_Time, Booking_Status 
      FROM booking 
      WHERE Charger_ID = ? 
        AND Booking_Date = ? 
        AND Booking_Status != 'Cancelled'
        AND (Start_Time < ? AND End_Time > ?)
    `;

    const [conflictingBookings] = await pool.query(overlapSql, [
      Charger_ID,
      Booking_Date,
      normEndTime,
      normStartTime
    ]);

    if (conflictingBookings.length > 0) {
      const conflict = conflictingBookings[0];
      throw AppError.conflict(
        `Time slot conflict: Charger ${Charger_ID} is already booked on ${Booking_Date} from ${conflict.Start_Time} to ${conflict.End_Time} (Booking ID: ${conflict.Booking_ID})`
      );
    }

    // 6. Insert new booking
    const status = Booking_Status || 'Confirmed';
    const [result] = await pool.query(
      `INSERT INTO booking 
        (Booking_Date, Start_Time, End_Time, Booking_Status, Customer_ID, Charger_ID) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [Booking_Date, normStartTime, normEndTime, status, targetCustomerId, Charger_ID]
    );

    // Fetch created booking with full details
    const [newBookingRows] = await pool.query(
      `SELECT 
        b.Booking_ID,
        b.Booking_Date,
        b.Start_Time,
        b.End_Time,
        b.Booking_Status,
        b.Customer_ID,
        c.Customer_Name,
        b.Charger_ID,
        cp.Charger_Type,
        cs.Station_Name,
        cs.Location AS Station_Location
      FROM booking b
      JOIN customer c ON b.Customer_ID = c.Customer_ID
      JOIN charging_point cp ON b.Charger_ID = cp.Charger_ID
      JOIN charging_station cs ON cp.Station_ID = cs.Station_ID
      WHERE b.Booking_ID = ?`,
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: newBookingRows[0]
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/bookings/:id/cancel (or PUT)
 * Cancel an active booking (CUSTOMER can only cancel own booking)
 */
async function handleCancelBooking(req, res, next) {
  try {
    const { id } = req.params;

    const [bookingRows] = await pool.query(
      `SELECT b.*, cs.Owner_User_ID 
       FROM booking b
       JOIN charging_point cp ON b.Charger_ID = cp.Charger_ID
       JOIN charging_station cs ON cp.Station_ID = cs.Station_ID
       WHERE b.Booking_ID = ?`,
      [id]
    );

    if (bookingRows.length === 0) {
      throw AppError.notFound(`Booking with ID ${id} not found`);
    }

    const booking = bookingRows[0];

    // Ownership check: CUSTOMER can only cancel own booking
    if (req.user.role === 'CUSTOMER' && booking.Customer_ID !== req.user.customer_id) {
      throw new AppError('Forbidden: You can only cancel your own bookings', 403);
    }

    // OWNER can only cancel bookings at own station
    if (req.user.role === 'OWNER' && booking.Owner_User_ID && booking.Owner_User_ID !== req.user.id) {
      throw new AppError('Forbidden: You can only cancel bookings for your own stations', 403);
    }

    if (booking.Booking_Status === 'Cancelled') {
      return res.json({
        success: true,
        message: 'Booking is already cancelled',
        data: booking
      });
    }

    if (booking.Booking_Status === 'Completed') {
      throw AppError.badRequest('Cannot cancel a booking that has already been completed');
    }

    await pool.query(
      'UPDATE booking SET Booking_Status = ? WHERE Booking_ID = ?',
      ['Cancelled', id]
    );

    const [updatedRows] = await pool.query(
      'SELECT * FROM booking WHERE Booking_ID = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Booking cancelled successfully',
      data: updatedRows[0]
    });
  } catch (error) {
    next(error);
  }
}

router.patch('/:id/cancel', handleCancelBooking);
router.put('/:id/cancel', handleCancelBooking);
router.post('/:id/cancel', handleCancelBooking);

/**
 * DELETE /api/bookings/:id
 * Delete a booking (restricted by ownership)
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const [existing] = await pool.query(
      `SELECT b.*, cs.Owner_User_ID 
       FROM booking b
       JOIN charging_point cp ON b.Charger_ID = cp.Charger_ID
       JOIN charging_station cs ON cp.Station_ID = cs.Station_ID
       WHERE b.Booking_ID = ?`,
      [id]
    );

    if (existing.length === 0) {
      throw AppError.notFound(`Booking with ID ${id} not found`);
    }

    const booking = existing[0];
    if (req.user.role === 'CUSTOMER' && booking.Customer_ID !== req.user.customer_id) {
      throw new AppError('Forbidden: You can only delete your own bookings', 403);
    }
    if (req.user.role === 'OWNER' && booking.Owner_User_ID && booking.Owner_User_ID !== req.user.id) {
      throw new AppError('Forbidden: You can only delete bookings for stations you own', 403);
    }

    await pool.query('DELETE FROM booking WHERE Booking_ID = ?', [id]);

    res.json({
      success: true,
      message: `Booking with ID ${id} deleted successfully`
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
