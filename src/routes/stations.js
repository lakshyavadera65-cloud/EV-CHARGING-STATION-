const express = require('express');
const { pool } = require('../db');
const { AppError } = require('../errorHandler');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();

/**
 * GET /api/stations
 * List all charging stations with optional filtering by status (accessible by all)
 */
router.get('/', async (req, res, next) => {
  try {
    const { status, search } = req.query;
    let query = `
      SELECT 
        cs.Station_ID,
        cs.Station_Name,
        cs.Location,
        cs.Contact_Number,
        cs.Total_Chargers,
        cs.Operating_Hours,
        cs.Status,
        cs.Owner_User_ID,
        (SELECT COUNT(*) FROM charging_point cp WHERE cp.Station_ID = cs.Station_ID) AS Actual_Chargers_Count
      FROM charging_station cs
    `;
    const params = [];
    const where = [];

    if (status) {
      where.push('cs.Status = ?');
      params.push(status);
    }

    if (search) {
      where.push('(cs.Station_Name LIKE ? OR cs.Location LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    if (where.length > 0) {
      query += ` WHERE ${where.join(' AND ')}`;
    }

    query += ' ORDER BY cs.Station_ID ASC';

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
 * GET /api/stations/:id
 * Get single station by ID with associated chargers and employees (accessible by all)
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const [stationRows] = await pool.query(
      'SELECT * FROM charging_station WHERE Station_ID = ?',
      [id]
    );

    if (stationRows.length === 0) {
      throw AppError.notFound(`Station with ID ${id} not found`);
    }

    const station = stationRows[0];

    // Fetch chargers at this station
    const [chargers] = await pool.query(
      'SELECT Charger_ID, Charger_Type, Connector_Type, Power_Output, Availability_Status FROM charging_point WHERE Station_ID = ?',
      [id]
    );

    // Fetch employees assigned to this station
    const [employees] = await pool.query(
      'SELECT Employee_ID, Employee_Name, Phone_Number, Email, Designation FROM employee WHERE Station_ID = ?',
      [id]
    );

    station.chargers = chargers;
    station.employees = employees;

    res.json({
      success: true,
      data: station
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/stations
 * Create a new charging station (OWNER only, Owner_User_ID automatically set to current user)
 */
router.post('/', requireAuth, requireRole('OWNER'), async (req, res, next) => {
  try {
    const { Station_Name, Location, Contact_Number, Total_Chargers, Operating_Hours, Status } = req.body;

    if (!Station_Name || !Location) {
      throw AppError.badRequest('Station_Name and Location are required');
    }

    const ownerUserId = req.user.id;

    const [result] = await pool.query(
      `INSERT INTO charging_station 
        (Station_Name, Location, Contact_Number, Total_Chargers, Operating_Hours, Status, Owner_User_ID) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        Station_Name,
        Location,
        Contact_Number || null,
        Total_Chargers !== undefined ? Total_Chargers : 0,
        Operating_Hours || '24 Hours',
        Status || 'Active',
        ownerUserId
      ]
    );

    const [newStation] = await pool.query(
      'SELECT * FROM charging_station WHERE Station_ID = ?',
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: 'Charging station created successfully',
      data: newStation[0]
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/stations/:id
 * Update an existing charging station (OWNER only, can only edit own station)
 */
router.put('/:id', requireAuth, requireRole('OWNER'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { Station_Name, Location, Contact_Number, Total_Chargers, Operating_Hours, Status } = req.body;

    const [existing] = await pool.query(
      'SELECT * FROM charging_station WHERE Station_ID = ?',
      [id]
    );

    if (existing.length === 0) {
      throw AppError.notFound(`Station with ID ${id} not found`);
    }

    const current = existing[0];

    // Ownership check: OWNER can only edit their own stations
    if (current.Owner_User_ID && current.Owner_User_ID !== req.user.id) {
      throw new AppError('Forbidden: You can only edit stations that belong to you', 403);
    }

    const updatedName = Station_Name !== undefined ? Station_Name : current.Station_Name;
    const updatedLocation = Location !== undefined ? Location : current.Location;
    const updatedContact = Contact_Number !== undefined ? Contact_Number : current.Contact_Number;
    const updatedTotal = Total_Chargers !== undefined ? Total_Chargers : current.Total_Chargers;
    const updatedHours = Operating_Hours !== undefined ? Operating_Hours : current.Operating_Hours;
    const updatedStatus = Status !== undefined ? Status : current.Status;

    await pool.query(
      `UPDATE charging_station 
       SET Station_Name = ?, Location = ?, Contact_Number = ?, Total_Chargers = ?, Operating_Hours = ?, Status = ? 
       WHERE Station_ID = ?`,
      [updatedName, updatedLocation, updatedContact, updatedTotal, updatedHours, updatedStatus, id]
    );

    const [updatedStation] = await pool.query(
      'SELECT * FROM charging_station WHERE Station_ID = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Charging station updated successfully',
      data: updatedStation[0]
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/stations/:id
 * Delete a charging station (OWNER only, can only delete own station)
 */
router.delete('/:id', requireAuth, requireRole('OWNER'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const [existing] = await pool.query(
      'SELECT * FROM charging_station WHERE Station_ID = ?',
      [id]
    );

    if (existing.length === 0) {
      throw AppError.notFound(`Station with ID ${id} not found`);
    }

    const current = existing[0];

    // Ownership check: OWNER can only delete their own stations
    if (current.Owner_User_ID && current.Owner_User_ID !== req.user.id) {
      throw new AppError('Forbidden: You can only delete stations that belong to you', 403);
    }

    await pool.query('DELETE FROM charging_station WHERE Station_ID = ?', [id]);

    res.json({
      success: true,
      message: `Station with ID ${id} deleted successfully`
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
