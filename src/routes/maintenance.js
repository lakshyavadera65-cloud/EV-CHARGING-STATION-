const express = require('express');
const { pool } = require('../db');
const { AppError } = require('../errorHandler');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();

// Maintenance management is restricted to OWNER role only
router.use(requireAuth, requireRole('OWNER'));

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
 * GET /api/maintenance
 * List maintenance records for chargers at stations owned by the authenticated owner
 */
router.get('/', async (req, res, next) => {
  try {
    const { status, charger_id, employee_id, station_id } = req.query;

    let query = `
      SELECT 
        m.Maintenance_ID,
        m.Maintenance_Date,
        m.Description,
        m.Status,
        m.Cost,
        m.Charger_ID,
        cp.Charger_Type,
        cp.Connector_Type,
        cp.Availability_Status AS Charger_Current_Status,
        cs.Station_ID,
        cs.Station_Name,
        cs.Location AS Station_Location,
        cs.Owner_User_ID,
        m.Employee_ID,
        e.Employee_Name,
        e.Designation
      FROM maintenance m
      JOIN charging_point cp ON m.Charger_ID = cp.Charger_ID
      JOIN charging_station cs ON cp.Station_ID = cs.Station_ID
      JOIN employee e ON m.Employee_ID = e.Employee_ID
      WHERE (cs.Owner_User_ID = ? OR cs.Owner_User_ID IS NULL)
    `;

    const params = [req.user.id];

    if (status) {
      query += ' AND m.Status = ?';
      params.push(status);
    }

    if (charger_id) {
      query += ' AND m.Charger_ID = ?';
      params.push(charger_id);
    }

    if (employee_id) {
      query += ' AND m.Employee_ID = ?';
      params.push(employee_id);
    }

    if (station_id) {
      query += ' AND cs.Station_ID = ?';
      params.push(station_id);
    }

    query += ' ORDER BY m.Maintenance_Date DESC, m.Maintenance_ID DESC';

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
 * GET /api/maintenance/:id
 * Get single maintenance record (must belong to owner's station)
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        m.Maintenance_ID,
        m.Maintenance_Date,
        m.Description,
        m.Status,
        m.Cost,
        m.Charger_ID,
        cp.Charger_Type,
        cp.Connector_Type,
        cp.Availability_Status AS Charger_Current_Status,
        cs.Station_ID,
        cs.Station_Name,
        cs.Location AS Station_Location,
        cs.Owner_User_ID,
        m.Employee_ID,
        e.Employee_Name,
        e.Designation,
        e.Phone_Number AS Employee_Phone
      FROM maintenance m
      JOIN charging_point cp ON m.Charger_ID = cp.Charger_ID
      JOIN charging_station cs ON cp.Station_ID = cs.Station_ID
      JOIN employee e ON m.Employee_ID = e.Employee_ID
      WHERE m.Maintenance_ID = ?
    `;

    const [rows] = await pool.query(query, [id]);
    if (rows.length === 0) {
      throw AppError.notFound(`Maintenance record with ID ${id} not found`);
    }

    const record = rows[0];
    if (record.Owner_User_ID && record.Owner_User_ID !== req.user.id) {
      throw new AppError('Forbidden: You can only view maintenance records for stations you own', 403);
    }

    res.json({
      success: true,
      data: record
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/maintenance
 * Create a maintenance record (charger must belong to owner's station)
 */
router.post('/', async (req, res, next) => {
  const connection = await pool.getConnection();

  try {
    const { Maintenance_Date, Description, Status, Cost, Charger_ID, Employee_ID } = req.body;

    if (!Charger_ID || !Employee_ID) {
      throw AppError.badRequest('Charger_ID and Employee_ID are required');
    }

    await connection.beginTransaction();

    // 1. Verify Charger exists and belongs to owner's station
    const [chargerRows] = await connection.query(
      `SELECT cp.Charger_ID, cp.Availability_Status, cs.Owner_User_ID 
       FROM charging_point cp 
       JOIN charging_station cs ON cp.Station_ID = cs.Station_ID 
       WHERE cp.Charger_ID = ? FOR UPDATE`,
      [Charger_ID]
    );

    if (chargerRows.length === 0) {
      throw AppError.notFound(`Charger with ID ${Charger_ID} not found`);
    }

    const charger = chargerRows[0];
    if (charger.Owner_User_ID && charger.Owner_User_ID !== req.user.id) {
      throw new AppError('Forbidden: You can only create maintenance records for chargers at stations you own', 403);
    }

    // 2. Verify Employee exists
    const [employeeRows] = await connection.query(
      'SELECT Employee_ID FROM employee WHERE Employee_ID = ?',
      [Employee_ID]
    );

    if (employeeRows.length === 0) {
      throw AppError.badRequest(`Employee with ID ${Employee_ID} not found`);
    }

    const recordStatus = Status || 'In Progress';
    const maintenanceDate = Maintenance_Date || toMysqlDate();
    const cost = Cost !== undefined && Cost !== null ? parseFloat(Cost) : 0.00;

    // 3. Insert into maintenance
    const [result] = await connection.query(
      `INSERT INTO maintenance 
        (Maintenance_Date, Description, Status, Cost, Charger_ID, Employee_ID) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [maintenanceDate, Description || null, recordStatus, cost, Charger_ID, Employee_ID]
    );

    const maintenanceId = result.insertId;

    // 4. Update charger status
    if (recordStatus === 'In Progress') {
      await connection.query(
        'UPDATE charging_point SET Availability_Status = ? WHERE Charger_ID = ?',
        ['Maintenance', Charger_ID]
      );
    } else if (recordStatus === 'Completed') {
      await connection.query(
        'UPDATE charging_point SET Availability_Status = ? WHERE Charger_ID = ?',
        ['Available', Charger_ID]
      );
    }

    await connection.commit();

    const [createdRows] = await pool.query(
      `SELECT m.*, cp.Availability_Status AS Charger_Status, e.Employee_Name 
       FROM maintenance m 
       JOIN charging_point cp ON m.Charger_ID = cp.Charger_ID 
       JOIN employee e ON m.Employee_ID = e.Employee_ID 
       WHERE m.Maintenance_ID = ?`,
      [maintenanceId]
    );

    res.status(201).json({
      success: true,
      message: `Maintenance record created. Charger is now '${recordStatus === 'In Progress' ? 'Maintenance' : 'Available'}'`,
      data: createdRows[0]
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

/**
 * PATCH /api/maintenance/:id/complete
 * Completes a maintenance record and sets charger back to 'Available'
 */
async function handleCompleteMaintenance(req, res, next) {
  const connection = await pool.getConnection();

  try {
    const { id } = req.params;
    const { Cost } = req.body;

    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT m.*, cs.Owner_User_ID 
       FROM maintenance m
       JOIN charging_point cp ON m.Charger_ID = cp.Charger_ID
       JOIN charging_station cs ON cp.Station_ID = cs.Station_ID
       WHERE m.Maintenance_ID = ? FOR UPDATE`,
      [id]
    );

    if (rows.length === 0) {
      throw AppError.notFound(`Maintenance record with ID ${id} not found`);
    }

    const record = rows[0];
    if (record.Owner_User_ID && record.Owner_User_ID !== req.user.id) {
      throw new AppError('Forbidden: You can only complete maintenance for stations you own', 403);
    }

    const finalCost = Cost !== undefined && Cost !== null ? parseFloat(Cost) : record.Cost;

    // Update maintenance to Completed
    await connection.query(
      'UPDATE maintenance SET Status = ?, Cost = ? WHERE Maintenance_ID = ?',
      ['Completed', finalCost, id]
    );

    // Set charger to Available
    await connection.query(
      'UPDATE charging_point SET Availability_Status = ? WHERE Charger_ID = ?',
      ['Available', record.Charger_ID]
    );

    await connection.commit();

    const [updatedRows] = await pool.query(
      `SELECT m.*, cp.Availability_Status AS Charger_Status, e.Employee_Name 
       FROM maintenance m 
       JOIN charging_point cp ON m.Charger_ID = cp.Charger_ID 
       JOIN employee e ON m.Employee_ID = e.Employee_ID 
       WHERE m.Maintenance_ID = ?`,
      [id]
    );

    res.json({
      success: true,
      message: 'Maintenance completed successfully. Charger is now Available.',
      data: updatedRows[0]
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

router.patch('/:id/complete', handleCompleteMaintenance);
router.post('/:id/complete', handleCompleteMaintenance);
router.put('/:id/complete', handleCompleteMaintenance);

/**
 * PUT /api/maintenance/:id
 * General update for maintenance record
 */
router.put('/:id', async (req, res, next) => {
  const connection = await pool.getConnection();

  try {
    const { id } = req.params;
    const { Maintenance_Date, Description, Status, Cost, Charger_ID, Employee_ID } = req.body;

    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT m.*, cs.Owner_User_ID 
       FROM maintenance m
       JOIN charging_point cp ON m.Charger_ID = cp.Charger_ID
       JOIN charging_station cs ON cp.Station_ID = cs.Station_ID
       WHERE m.Maintenance_ID = ? FOR UPDATE`,
      [id]
    );

    if (rows.length === 0) {
      throw AppError.notFound(`Maintenance record with ID ${id} not found`);
    }

    const current = rows[0];
    if (current.Owner_User_ID && current.Owner_User_ID !== req.user.id) {
      throw new AppError('Forbidden: You can only edit maintenance records for stations you own', 403);
    }

    const updatedDate = Maintenance_Date !== undefined ? Maintenance_Date : current.Maintenance_Date;
    const updatedDesc = Description !== undefined ? Description : current.Description;
    const updatedStatus = Status !== undefined ? Status : current.Status;
    const updatedCost = Cost !== undefined ? parseFloat(Cost) : current.Cost;
    const updatedCharger = Charger_ID !== undefined ? Charger_ID : current.Charger_ID;
    const updatedEmployee = Employee_ID !== undefined ? Employee_ID : current.Employee_ID;

    await connection.query(
      `UPDATE maintenance 
       SET Maintenance_Date = ?, Description = ?, Status = ?, Cost = ?, Charger_ID = ?, Employee_ID = ? 
       WHERE Maintenance_ID = ?`,
      [updatedDate, updatedDesc, updatedStatus, updatedCost, updatedCharger, updatedEmployee, id]
    );

    if (updatedStatus === 'Completed' && current.Status !== 'Completed') {
      await connection.query(
        'UPDATE charging_point SET Availability_Status = ? WHERE Charger_ID = ?',
        ['Available', updatedCharger]
      );
    } else if (updatedStatus === 'In Progress') {
      await connection.query(
        'UPDATE charging_point SET Availability_Status = ? WHERE Charger_ID = ?',
        ['Maintenance', updatedCharger]
      );
    }

    await connection.commit();

    const [updatedRows] = await pool.query(
      `SELECT m.*, cp.Availability_Status AS Charger_Status 
       FROM maintenance m 
       JOIN charging_point cp ON m.Charger_ID = cp.Charger_ID 
       WHERE m.Maintenance_ID = ?`,
      [id]
    );

    res.json({
      success: true,
      message: 'Maintenance record updated successfully',
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
 * DELETE /api/maintenance/:id
 * Delete maintenance record
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const [existing] = await pool.query(
      `SELECT m.*, cs.Owner_User_ID 
       FROM maintenance m
       JOIN charging_point cp ON m.Charger_ID = cp.Charger_ID
       JOIN charging_station cs ON cp.Station_ID = cs.Station_ID
       WHERE m.Maintenance_ID = ?`,
      [id]
    );

    if (existing.length === 0) {
      throw AppError.notFound(`Maintenance record with ID ${id} not found`);
    }

    const current = existing[0];
    if (current.Owner_User_ID && current.Owner_User_ID !== req.user.id) {
      throw new AppError('Forbidden: You can only delete maintenance records for stations you own', 403);
    }

    await pool.query('DELETE FROM maintenance WHERE Maintenance_ID = ?', [id]);

    res.json({
      success: true,
      message: `Maintenance record with ID ${id} deleted successfully`
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
