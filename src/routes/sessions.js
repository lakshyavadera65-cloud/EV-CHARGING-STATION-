const express = require('express');
const { pool } = require('../db');
const { AppError } = require('../errorHandler');
const { requireAuth } = require('../auth');

const router = express.Router();

// All session operations require authentication
router.use(requireAuth);

/**
 * Format Date to MySQL DATETIME string: YYYY-MM-DD HH:MM:SS
 * @param {Date} [date]
 * @returns {string}
 */
function toMysqlDatetime(date = new Date()) {
  const d = new Date(date);
  const pad = n => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * GET /api/sessions
 * List charging sessions:
 * - CUSTOMER sees only their own sessions
 * - OWNER sees sessions at their own stations
 */
router.get('/', async (req, res, next) => {
  try {
    const { status, customer_id, charger_id, station_id } = req.query;

    let query = `
      SELECT 
        cs.Session_ID,
        cs.Session_Start,
        cs.Session_End,
        cs.Energy_Consumed,
        cs.Charging_Cost,
        cs.Booking_ID,
        b.Booking_Date,
        b.Booking_Status,
        c.Customer_ID,
        c.Customer_Name,
        cp.Charger_ID,
        cp.Charger_Type,
        cp.Availability_Status AS Charger_Availability,
        st.Station_ID,
        st.Station_Name,
        st.Owner_User_ID,
        p.Payment_ID,
        p.Payment_Status,
        p.Payment_Method
      FROM charging_session cs
      JOIN booking b ON cs.Booking_ID = b.Booking_ID
      JOIN customer c ON b.Customer_ID = c.Customer_ID
      JOIN charging_point cp ON b.Charger_ID = cp.Charger_ID
      JOIN charging_station st ON cp.Station_ID = st.Station_ID
      LEFT JOIN payment p ON cs.Session_ID = p.Session_ID
    `;

    const params = [];
    const where = [];

    // Role-based visibility
    if (req.user.role === 'CUSTOMER') {
      where.push('c.Customer_ID = ?');
      params.push(req.user.customer_id);
    } else if (req.user.role === 'OWNER') {
      where.push('(st.Owner_User_ID = ? OR st.Owner_User_ID IS NULL)');
      params.push(req.user.id);
    }

    if (customer_id && req.user.role === 'OWNER') {
      where.push('c.Customer_ID = ?');
      params.push(customer_id);
    }

    if (charger_id) {
      where.push('cp.Charger_ID = ?');
      params.push(charger_id);
    }

    if (station_id) {
      where.push('st.Station_ID = ?');
      params.push(station_id);
    }

    if (status === 'active') {
      where.push('cs.Session_End IS NULL');
    } else if (status === 'completed') {
      where.push('cs.Session_End IS NOT NULL');
    }

    if (where.length > 0) {
      query += ` WHERE ${where.join(' AND ')}`;
    }

    query += ' ORDER BY cs.Session_Start DESC';

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
 * GET /api/sessions/:id
 * Get single session by ID (CUSTOMER only own; OWNER only own station)
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        cs.Session_ID,
        cs.Session_Start,
        cs.Session_End,
        cs.Energy_Consumed,
        cs.Charging_Cost,
        cs.Booking_ID,
        b.Booking_Date,
        b.Booking_Status,
        c.Customer_ID,
        c.Customer_Name,
        c.Phone_Number AS Customer_Phone,
        cp.Charger_ID,
        cp.Charger_Type,
        cp.Connector_Type,
        cp.Availability_Status AS Charger_Availability,
        st.Station_ID,
        st.Station_Name,
        st.Location AS Station_Location,
        st.Owner_User_ID,
        p.Payment_ID,
        p.Amount AS Paid_Amount,
        p.Payment_Status,
        p.Payment_Method,
        p.Payment_Date
      FROM charging_session cs
      JOIN booking b ON cs.Booking_ID = b.Booking_ID
      JOIN customer c ON b.Customer_ID = c.Customer_ID
      JOIN charging_point cp ON b.Charger_ID = cp.Charger_ID
      JOIN charging_station st ON cp.Station_ID = st.Station_ID
      LEFT JOIN payment p ON cs.Session_ID = p.Session_ID
      WHERE cs.Session_ID = ?
    `;

    const [rows] = await pool.query(query, [id]);
    if (rows.length === 0) {
      throw AppError.notFound(`Charging session with ID ${id} not found`);
    }

    const session = rows[0];

    // Authorization checks
    if (req.user.role === 'CUSTOMER' && session.Customer_ID !== req.user.customer_id) {
      throw new AppError('Forbidden: You can only view your own charging sessions', 403);
    }

    if (req.user.role === 'OWNER' && session.Owner_User_ID && session.Owner_User_ID !== req.user.id) {
      throw new AppError('Forbidden: You can only view sessions for stations you own', 403);
    }

    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/sessions/start
 * Starts a charging session from a Confirmed booking.
 * CUSTOMER can only start their own booking.
 */
router.post('/start', async (req, res, next) => {
  const connection = await pool.getConnection();

  try {
    const { Booking_ID, Session_Start } = req.body;

    if (!Booking_ID) {
      throw AppError.badRequest('Booking_ID is required to start a session');
    }

    await connection.beginTransaction();

    // 1. Fetch booking with lock
    const [bookingRows] = await connection.query(
      `SELECT b.*, cp.Availability_Status AS Charger_Status, cs.Owner_User_ID 
       FROM booking b 
       JOIN charging_point cp ON b.Charger_ID = cp.Charger_ID 
       JOIN charging_station cs ON cp.Station_ID = cs.Station_ID
       WHERE b.Booking_ID = ? FOR UPDATE`,
      [Booking_ID]
    );

    if (bookingRows.length === 0) {
      throw AppError.notFound(`Booking with ID ${Booking_ID} not found`);
    }

    const booking = bookingRows[0];

    // Ownership check: CUSTOMER can only start sessions for their own bookings
    if (req.user.role === 'CUSTOMER' && booking.Customer_ID !== req.user.customer_id) {
      throw new AppError('Forbidden: You can only start charging sessions for your own bookings', 403);
    }

    // If OWNER, ensure station belongs to them
    if (req.user.role === 'OWNER' && booking.Owner_User_ID && booking.Owner_User_ID !== req.user.id) {
      throw new AppError('Forbidden: You can only start sessions at stations you own', 403);
    }

    // 2. Validate booking status is 'Confirmed'
    if (booking.Booking_Status !== 'Confirmed') {
      throw AppError.badRequest(
        `Cannot start session. Booking status must be 'Confirmed', but is currently '${booking.Booking_Status}'`
      );
    }

    // 3. Check if charger is under maintenance
    if (booking.Charger_Status === 'Maintenance') {
      throw AppError.badRequest('Cannot start session: charger is currently under maintenance');
    }

    // 4. Verify no session exists for this Booking_ID
    const [existingSession] = await connection.query(
      'SELECT Session_ID FROM charging_session WHERE Booking_ID = ?',
      [Booking_ID]
    );

    if (existingSession.length > 0) {
      throw AppError.conflict(
        `A charging session already exists for Booking ID ${Booking_ID} (Session ID: ${existingSession[0].Session_ID})`
      );
    }

    const startTime = Session_Start || toMysqlDatetime();

    // 5. Insert into charging_session
    const [sessionResult] = await connection.query(
      'INSERT INTO charging_session (Session_Start, Booking_ID) VALUES (?, ?)',
      [startTime, Booking_ID]
    );

    const sessionId = sessionResult.insertId;

    // 6. Update charger status to 'Occupied'
    await connection.query(
      'UPDATE charging_point SET Availability_Status = ? WHERE Charger_ID = ?',
      ['Occupied', booking.Charger_ID]
    );

    await connection.commit();

    // Fetch created session details
    const [newSession] = await pool.query(
      `SELECT cs.*, b.Charger_ID, cp.Availability_Status AS Charger_Status, c.Customer_Name 
       FROM charging_session cs 
       JOIN booking b ON cs.Booking_ID = b.Booking_ID 
       JOIN customer c ON b.Customer_ID = c.Customer_ID 
       JOIN charging_point cp ON b.Charger_ID = cp.Charger_ID 
       WHERE cs.Session_ID = ?`,
      [sessionId]
    );

    res.status(201).json({
      success: true,
      message: 'Charging session started successfully; charger is now Occupied',
      data: newSession[0]
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

/**
 * POST /api/sessions/:id/end
 * Ends an active charging session (CUSTOMER can only end own session)
 */
router.post('/:id/end', async (req, res, next) => {
  const connection = await pool.getConnection();

  try {
    const { id } = req.params;
    const { Energy_Consumed, Session_End } = req.body;

    if (Energy_Consumed === undefined || Energy_Consumed === null || isNaN(Number(Energy_Consumed))) {
      throw AppError.badRequest('Valid Energy_Consumed (numeric kWh) is required to end the session');
    }

    const energyKwh = parseFloat(Energy_Consumed);
    if (energyKwh < 0) {
      throw AppError.badRequest('Energy_Consumed cannot be negative');
    }

    await connection.beginTransaction();

    // 1. Fetch session and related booking with lock
    const [sessionRows] = await connection.query(
      `SELECT cs.*, b.Booking_ID, b.Charger_ID, b.Customer_ID, b.Booking_Status, st.Owner_User_ID 
       FROM charging_session cs 
       JOIN booking b ON cs.Booking_ID = b.Booking_ID 
       JOIN charging_point cp ON b.Charger_ID = cp.Charger_ID
       JOIN charging_station st ON cp.Station_ID = st.Station_ID
       WHERE cs.Session_ID = ? FOR UPDATE`,
      [id]
    );

    if (sessionRows.length === 0) {
      throw AppError.notFound(`Charging session with ID ${id} not found`);
    }

    const session = sessionRows[0];

    // Ownership check: CUSTOMER can only end their own sessions
    if (req.user.role === 'CUSTOMER' && session.Customer_ID !== req.user.customer_id) {
      throw new AppError('Forbidden: You can only end your own charging sessions', 403);
    }

    // OWNER can only end sessions at stations they own
    if (req.user.role === 'OWNER' && session.Owner_User_ID && session.Owner_User_ID !== req.user.id) {
      throw new AppError('Forbidden: You can only end sessions at stations you own', 403);
    }

    if (session.Session_End !== null) {
      throw AppError.badRequest(`Charging session ${id} has already been ended at ${session.Session_End}`);
    }

    // 2. Compute cost: kWh * RATE_PER_KWH
    const ratePerKwh = parseFloat(process.env.RATE_PER_KWH) || 12.00;
    const chargingCost = parseFloat((energyKwh * ratePerKwh).toFixed(2));
    const endTime = Session_End || toMysqlDatetime();

    // 3. Update charging_session
    await connection.query(
      `UPDATE charging_session 
       SET Session_End = ?, Energy_Consumed = ?, Charging_Cost = ? 
       WHERE Session_ID = ?`,
      [endTime, energyKwh, chargingCost, id]
    );

    // 4. Update booking status to 'Completed'
    await connection.query(
      'UPDATE booking SET Booking_Status = ? WHERE Booking_ID = ?',
      ['Completed', session.Booking_ID]
    );

    // 5. Update charger status to 'Available'
    await connection.query(
      'UPDATE charging_point SET Availability_Status = ? WHERE Charger_ID = ?',
      ['Available', session.Charger_ID]
    );

    await connection.commit();

    // Fetch updated session
    const [updatedRows] = await pool.query(
      `SELECT 
        cs.*, 
        b.Booking_Status, 
        b.Charger_ID, 
        cp.Availability_Status AS Charger_Status,
        c.Customer_Name
       FROM charging_session cs 
       JOIN booking b ON cs.Booking_ID = b.Booking_ID 
       JOIN customer c ON b.Customer_ID = c.Customer_ID 
       JOIN charging_point cp ON b.Charger_ID = cp.Charger_ID 
       WHERE cs.Session_ID = ?`,
      [id]
    );

    res.json({
      success: true,
      message: 'Charging session ended successfully; booking completed and charger is now Available',
      calculation: {
        energy_kwh: energyKwh,
        rate_per_kwh: ratePerKwh,
        charging_cost: chargingCost
      },
      data: updatedRows[0]
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

/**
 * DELETE /api/sessions/:id
 * Delete a session (restricted by ownership)
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const [existing] = await pool.query(
      `SELECT cs.*, b.Customer_ID, st.Owner_User_ID 
       FROM charging_session cs
       JOIN booking b ON cs.Booking_ID = b.Booking_ID
       JOIN charging_point cp ON b.Charger_ID = cp.Charger_ID
       JOIN charging_station st ON cp.Station_ID = st.Station_ID
       WHERE cs.Session_ID = ?`,
      [id]
    );

    if (existing.length === 0) {
      throw AppError.notFound(`Charging session with ID ${id} not found`);
    }

    const session = existing[0];
    if (req.user.role === 'CUSTOMER' && session.Customer_ID !== req.user.customer_id) {
      throw new AppError('Forbidden: You can only delete your own charging sessions', 403);
    }
    if (req.user.role === 'OWNER' && session.Owner_User_ID && session.Owner_User_ID !== req.user.id) {
      throw new AppError('Forbidden: You can only delete sessions at stations you own', 403);
    }

    await pool.query('DELETE FROM charging_session WHERE Session_ID = ?', [id]);

    res.json({
      success: true,
      message: `Charging session with ID ${id} deleted successfully`
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
