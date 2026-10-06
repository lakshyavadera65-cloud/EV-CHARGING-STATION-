const express = require('express');
const { pool } = require('../db');
const { AppError } = require('../errorHandler');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();

/**
 * GET /api/chargers
 * List all charging points with joined station details and optional filters (accessible by all)
 */
router.get('/', async (req, res, next) => {
  try {
    const { station_id, status, type, connector } = req.query;

    let query = `
      SELECT 
        cp.Charger_ID,
        cp.Charger_Type,
        cp.Connector_Type,
        cp.Power_Output,
        cp.Availability_Status,
        cp.Station_ID,
        cs.Station_Name,
        cs.Location AS Station_Location,
        cs.Owner_User_ID
      FROM charging_point cp
      JOIN charging_station cs ON cp.Station_ID = cs.Station_ID
    `;
    const params = [];
    const where = [];

    if (station_id) {
      where.push('cp.Station_ID = ?');
      params.push(station_id);
    }

    if (status) {
      where.push('cp.Availability_Status = ?');
      params.push(status);
    }

    if (type) {
      where.push('cp.Charger_Type = ?');
      params.push(type);
    }

    if (connector) {
      where.push('cp.Connector_Type = ?');
      params.push(connector);
    }

    if (where.length > 0) {
      query += ` WHERE ${where.join(' AND ')}`;
    }

    query += ' ORDER BY cp.Charger_ID ASC';

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
 * GET /api/chargers/:id
 * Get single charger by ID with station details (accessible by all)
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        cp.Charger_ID,
        cp.Charger_Type,
        cp.Connector_Type,
        cp.Power_Output,
        cp.Availability_Status,
        cp.Station_ID,
        cs.Station_Name,
        cs.Location AS Station_Location,
        cs.Contact_Number AS Station_Contact,
        cs.Owner_User_ID
      FROM charging_point cp
      JOIN charging_station cs ON cp.Station_ID = cs.Station_ID
      WHERE cp.Charger_ID = ?
    `;

    const [rows] = await pool.query(query, [id]);
    if (rows.length === 0) {
      throw AppError.notFound(`Charger with ID ${id} not found`);
    }

    res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/chargers
 * Create a new charger (OWNER only, can only add chargers to own station)
 */
router.post('/', requireAuth, requireRole('OWNER'), async (req, res, next) => {
  try {
    const { Charger_Type, Connector_Type, Power_Output, Availability_Status, Station_ID } = req.body;

    if (!Charger_Type || !Connector_Type || !Station_ID) {
      throw AppError.badRequest('Charger_Type, Connector_Type, and Station_ID are required');
    }

    // Verify station exists and check ownership
    const [stationRows] = await pool.query(
      'SELECT Station_ID, Owner_User_ID FROM charging_station WHERE Station_ID = ?',
      [Station_ID]
    );

    if (stationRows.length === 0) {
      throw AppError.badRequest(`Charging station with ID ${Station_ID} does not exist`);
    }

    const station = stationRows[0];
    if (station.Owner_User_ID && station.Owner_User_ID !== req.user.id) {
      throw new AppError('Forbidden: You can only add chargers to stations you own', 403);
    }

    const initialStatus = Availability_Status || 'Available';

    const [result] = await pool.query(
      `INSERT INTO charging_point 
        (Charger_Type, Connector_Type, Power_Output, Availability_Status, Station_ID) 
       VALUES (?, ?, ?, ?, ?)`,
      [Charger_Type, Connector_Type, Power_Output || 0.00, initialStatus, Station_ID]
    );

    const [newCharger] = await pool.query(
      `SELECT cp.*, cs.Station_Name 
       FROM charging_point cp 
       JOIN charging_station cs ON cp.Station_ID = cs.Station_ID 
       WHERE cp.Charger_ID = ?`,
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: 'Charger created successfully',
      data: newCharger[0]
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/chargers/:id
 * Update charger details (OWNER only, can only edit chargers at own station)
 */
router.put('/:id', requireAuth, requireRole('OWNER'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { Charger_Type, Connector_Type, Power_Output, Availability_Status, Station_ID } = req.body;

    const [existing] = await pool.query(
      `SELECT cp.*, cs.Owner_User_ID 
       FROM charging_point cp 
       JOIN charging_station cs ON cp.Station_ID = cs.Station_ID 
       WHERE cp.Charger_ID = ?`,
      [id]
    );

    if (existing.length === 0) {
      throw AppError.notFound(`Charger with ID ${id} not found`);
    }

    const current = existing[0];

    // Ownership check on current station
    if (current.Owner_User_ID && current.Owner_User_ID !== req.user.id) {
      throw new AppError('Forbidden: You can only edit chargers at stations you own', 403);
    }

    // If changing station, verify target station belongs to the owner
    const targetStationId = Station_ID !== undefined ? Station_ID : current.Station_ID;
    if (Station_ID !== undefined && Station_ID !== current.Station_ID) {
      const [stationRows] = await pool.query(
        'SELECT Station_ID, Owner_User_ID FROM charging_station WHERE Station_ID = ?',
        [Station_ID]
      );
      if (stationRows.length === 0) {
        throw AppError.badRequest(`Station with ID ${Station_ID} does not exist`);
      }
      if (stationRows[0].Owner_User_ID && stationRows[0].Owner_User_ID !== req.user.id) {
        throw new AppError('Forbidden: You can only move chargers to stations you own', 403);
      }
    }

    const updatedType = Charger_Type !== undefined ? Charger_Type : current.Charger_Type;
    const updatedConnector = Connector_Type !== undefined ? Connector_Type : current.Connector_Type;
    const updatedPower = Power_Output !== undefined ? Power_Output : current.Power_Output;
    const updatedStatus = Availability_Status !== undefined ? Availability_Status : current.Availability_Status;

    await pool.query(
      `UPDATE charging_point 
       SET Charger_Type = ?, Connector_Type = ?, Power_Output = ?, Availability_Status = ?, Station_ID = ? 
       WHERE Charger_ID = ?`,
      [updatedType, updatedConnector, updatedPower, updatedStatus, targetStationId, id]
    );

    const [updatedRows] = await pool.query(
      `SELECT cp.*, cs.Station_Name 
       FROM charging_point cp 
       JOIN charging_station cs ON cp.Station_ID = cs.Station_ID 
       WHERE cp.Charger_ID = ?`,
      [id]
    );

    res.json({
      success: true,
      message: 'Charger updated successfully',
      data: updatedRows[0]
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/chargers/:id
 * Delete a charger (OWNER only, can only delete chargers at own station)
 */
router.delete('/:id', requireAuth, requireRole('OWNER'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const [existing] = await pool.query(
      `SELECT cp.*, cs.Owner_User_ID 
       FROM charging_point cp 
       JOIN charging_station cs ON cp.Station_ID = cs.Station_ID 
       WHERE cp.Charger_ID = ?`,
      [id]
    );

    if (existing.length === 0) {
      throw AppError.notFound(`Charger with ID ${id} not found`);
    }

    const current = existing[0];
    if (current.Owner_User_ID && current.Owner_User_ID !== req.user.id) {
      throw new AppError('Forbidden: You can only delete chargers at stations you own', 403);
    }

    await pool.query('DELETE FROM charging_point WHERE Charger_ID = ?', [id]);

    res.json({
      success: true,
      message: `Charger with ID ${id} deleted successfully`
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
