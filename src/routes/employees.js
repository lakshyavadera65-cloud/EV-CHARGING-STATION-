const express = require('express');
const { pool } = require('../db');
const { AppError } = require('../errorHandler');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();

// Employees management is restricted to OWNER role only
router.use(requireAuth, requireRole('OWNER'));

/**
 * GET /api/employees
 * List all employees for stations owned by the authenticated owner
 */
router.get('/', async (req, res, next) => {
  try {
    const { station_id, designation, search } = req.query;

    let query = `
      SELECT 
        e.Employee_ID,
        e.Employee_Name,
        e.Phone_Number,
        e.Email,
        e.Designation,
        e.Station_ID,
        cs.Station_Name,
        cs.Location AS Station_Location,
        cs.Owner_User_ID
      FROM employee e
      JOIN charging_station cs ON e.Station_ID = cs.Station_ID
      WHERE (cs.Owner_User_ID = ? OR cs.Owner_User_ID IS NULL)
    `;
    const params = [req.user.id];

    if (station_id) {
      query += ' AND e.Station_ID = ?';
      params.push(station_id);
    }

    if (designation) {
      query += ' AND e.Designation = ?';
      params.push(designation);
    }

    if (search) {
      query += ' AND (e.Employee_Name LIKE ? OR e.Email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY e.Employee_ID ASC';

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
 * GET /api/employees/:id
 * Get single employee by ID (must belong to owner's station)
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        e.Employee_ID,
        e.Employee_Name,
        e.Phone_Number,
        e.Email,
        e.Designation,
        e.Station_ID,
        cs.Station_Name,
        cs.Location AS Station_Location,
        cs.Owner_User_ID
      FROM employee e
      JOIN charging_station cs ON e.Station_ID = cs.Station_ID
      WHERE e.Employee_ID = ?
    `;

    const [rows] = await pool.query(query, [id]);
    if (rows.length === 0) {
      throw AppError.notFound(`Employee with ID ${id} not found`);
    }

    const employee = rows[0];

    // Ownership check
    if (employee.Owner_User_ID && employee.Owner_User_ID !== req.user.id) {
      throw new AppError('Forbidden: You can only view employees at stations you own', 403);
    }

    // Fetch maintenance tasks assigned to this employee
    const [maintenanceTasks] = await pool.query(
      `SELECT m.Maintenance_ID, m.Maintenance_Date, m.Description, m.Status, m.Cost, m.Charger_ID
       FROM maintenance m
       WHERE m.Employee_ID = ?
       ORDER BY m.Maintenance_Date DESC`,
      [id]
    );

    employee.maintenance_tasks = maintenanceTasks;

    res.json({
      success: true,
      data: employee
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/employees
 * Create a new employee (must belong to owner's station)
 */
router.post('/', async (req, res, next) => {
  try {
    const { Employee_Name, Phone_Number, Email, Designation, Station_ID } = req.body;

    if (!Employee_Name || !Station_ID) {
      throw AppError.badRequest('Employee_Name and Station_ID are required');
    }

    // Verify station exists and belongs to the owner
    const [stationRows] = await pool.query(
      'SELECT Station_ID, Owner_User_ID FROM charging_station WHERE Station_ID = ?',
      [Station_ID]
    );

    if (stationRows.length === 0) {
      throw AppError.badRequest(`Station with ID ${Station_ID} does not exist`);
    }

    const station = stationRows[0];
    if (station.Owner_User_ID && station.Owner_User_ID !== req.user.id) {
      throw new AppError('Forbidden: You can only add employees to stations you own', 403);
    }

    const [result] = await pool.query(
      `INSERT INTO employee (Employee_Name, Phone_Number, Email, Designation, Station_ID) 
       VALUES (?, ?, ?, ?, ?)`,
      [Employee_Name, Phone_Number || null, Email || null, Designation || 'Technician', Station_ID]
    );

    const [newEmployee] = await pool.query(
      `SELECT e.*, cs.Station_Name 
       FROM employee e 
       JOIN charging_station cs ON e.Station_ID = cs.Station_ID 
       WHERE e.Employee_ID = ?`,
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: 'Employee created successfully',
      data: newEmployee[0]
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/employees/:id
 * Update employee details (must belong to owner's station)
 */
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { Employee_Name, Phone_Number, Email, Designation, Station_ID } = req.body;

    const [existing] = await pool.query(
      `SELECT e.*, cs.Owner_User_ID 
       FROM employee e 
       JOIN charging_station cs ON e.Station_ID = cs.Station_ID 
       WHERE e.Employee_ID = ?`,
      [id]
    );

    if (existing.length === 0) {
      throw AppError.notFound(`Employee with ID ${id} not found`);
    }

    const current = existing[0];
    if (current.Owner_User_ID && current.Owner_User_ID !== req.user.id) {
      throw new AppError('Forbidden: You can only edit employees at stations you own', 403);
    }

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
        throw new AppError('Forbidden: You can only assign employees to stations you own', 403);
      }
    }

    const updatedName = Employee_Name !== undefined ? Employee_Name : current.Employee_Name;
    const updatedPhone = Phone_Number !== undefined ? Phone_Number : current.Phone_Number;
    const updatedEmail = Email !== undefined ? Email : current.Email;
    const updatedDesignation = Designation !== undefined ? Designation : current.Designation;

    await pool.query(
      `UPDATE employee 
       SET Employee_Name = ?, Phone_Number = ?, Email = ?, Designation = ?, Station_ID = ? 
       WHERE Employee_ID = ?`,
      [updatedName, updatedPhone, updatedEmail, updatedDesignation, targetStationId, id]
    );

    const [updatedRows] = await pool.query(
      `SELECT e.*, cs.Station_Name 
       FROM employee e 
       JOIN charging_station cs ON e.Station_ID = cs.Station_ID 
       WHERE e.Employee_ID = ?`,
      [id]
    );

    res.json({
      success: true,
      message: 'Employee updated successfully',
      data: updatedRows[0]
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/employees/:id
 * Delete an employee (must belong to owner's station)
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const [existing] = await pool.query(
      `SELECT e.*, cs.Owner_User_ID 
       FROM employee e 
       JOIN charging_station cs ON e.Station_ID = cs.Station_ID 
       WHERE e.Employee_ID = ?`,
      [id]
    );

    if (existing.length === 0) {
      throw AppError.notFound(`Employee with ID ${id} not found`);
    }

    const current = existing[0];
    if (current.Owner_User_ID && current.Owner_User_ID !== req.user.id) {
      throw new AppError('Forbidden: You can only delete employees at stations you own', 403);
    }

    await pool.query('DELETE FROM employee WHERE Employee_ID = ?', [id]);

    res.json({
      success: true,
      message: `Employee with ID ${id} deleted successfully`
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
