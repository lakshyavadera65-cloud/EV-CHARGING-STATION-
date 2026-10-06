const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();

// Reports are restricted to OWNER role only
router.use(requireAuth, requireRole('OWNER'));

/**
 * GET /api/reports/revenue-by-station
 * Revenue per station report (limited to owner's stations)
 */
router.get('/revenue-by-station', async (req, res, next) => {
  try {
    const ownerId = req.user.id;

    const query = `
      SELECT 
        cs.Station_ID,
        cs.Station_Name,
        cs.Location,
        cs.Owner_User_ID,
        COUNT(DISTINCT cp.Charger_ID) AS Total_Chargers,
        COUNT(DISTINCT sess.Session_ID) AS Total_Sessions,
        COALESCE(ROUND(SUM(sess.Energy_Consumed), 2), 0.00) AS Total_Energy_KWh,
        COALESCE(ROUND(SUM(p.Amount), 2), 0.00) AS Total_Revenue
      FROM charging_station cs
      LEFT JOIN charging_point cp ON cs.Station_ID = cp.Station_ID
      LEFT JOIN booking b ON cp.Charger_ID = b.Charger_ID
      LEFT JOIN charging_session sess ON b.Booking_ID = sess.Booking_ID
      LEFT JOIN payment p ON sess.Session_ID = p.Session_ID AND p.Payment_Status = 'Paid'
      WHERE (cs.Owner_User_ID = ? OR cs.Owner_User_ID IS NULL)
      GROUP BY cs.Station_ID, cs.Station_Name, cs.Location, cs.Owner_User_ID
      ORDER BY Total_Revenue DESC, cs.Station_ID ASC
    `;

    const [rows] = await pool.query(query, [ownerId]);

    const totalPlatformRevenue = rows.reduce((sum, r) => sum + parseFloat(r.Total_Revenue || 0), 0);
    const totalPlatformEnergy = rows.reduce((sum, r) => sum + parseFloat(r.Total_Energy_KWh || 0), 0);

    res.json({
      success: true,
      report: 'Revenue per Station',
      totals: {
        total_revenue: parseFloat(totalPlatformRevenue.toFixed(2)),
        total_energy_kwh: parseFloat(totalPlatformEnergy.toFixed(2))
      },
      count: rows.length,
      data: rows
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/reports/customer-energy-usage
 * Customer-wise energy usage report (limited to owner's stations)
 */
router.get('/customer-energy-usage', async (req, res, next) => {
  try {
    const ownerId = req.user.id;

    const query = `
      SELECT 
        c.Customer_ID,
        c.Customer_Name,
        c.Email,
        c.Phone_Number,
        COUNT(DISTINCT b.Booking_ID) AS Total_Bookings,
        COUNT(DISTINCT sess.Session_ID) AS Total_Sessions,
        COALESCE(ROUND(SUM(sess.Energy_Consumed), 2), 0.00) AS Total_Energy_KWh,
        COALESCE(ROUND(SUM(p.Amount), 2), 0.00) AS Total_Spent
      FROM customer c
      JOIN booking b ON c.Customer_ID = b.Customer_ID
      JOIN charging_point cp ON b.Charger_ID = cp.Charger_ID
      JOIN charging_station cs ON cp.Station_ID = cs.Station_ID
      LEFT JOIN charging_session sess ON b.Booking_ID = sess.Booking_ID
      LEFT JOIN payment p ON sess.Session_ID = p.Session_ID AND p.Payment_Status = 'Paid'
      WHERE (cs.Owner_User_ID = ? OR cs.Owner_User_ID IS NULL)
      GROUP BY c.Customer_ID, c.Customer_Name, c.Email, c.Phone_Number
      ORDER BY Total_Energy_KWh DESC, c.Customer_ID ASC
    `;

    const [rows] = await pool.query(query, [ownerId]);

    res.json({
      success: true,
      report: 'Customer-wise Energy Usage',
      count: rows.length,
      data: rows
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/reports/maintenance-cost-by-station
 * Maintenance cost per station report (limited to owner's stations)
 */
router.get('/maintenance-cost-by-station', async (req, res, next) => {
  try {
    const ownerId = req.user.id;

    const query = `
      SELECT 
        cs.Station_ID,
        cs.Station_Name,
        cs.Location,
        cs.Owner_User_ID,
        COUNT(m.Maintenance_ID) AS Total_Maintenance_Events,
        SUM(CASE WHEN m.Status = 'In Progress' THEN 1 ELSE 0 END) AS In_Progress_Events,
        SUM(CASE WHEN m.Status = 'Completed' THEN 1 ELSE 0 END) AS Completed_Events,
        COALESCE(ROUND(SUM(m.Cost), 2), 0.00) AS Total_Maintenance_Cost
      FROM charging_station cs
      LEFT JOIN charging_point cp ON cs.Station_ID = cp.Station_ID
      LEFT JOIN maintenance m ON cp.Charger_ID = m.Charger_ID
      WHERE (cs.Owner_User_ID = ? OR cs.Owner_User_ID IS NULL)
      GROUP BY cs.Station_ID, cs.Station_Name, cs.Location, cs.Owner_User_ID
      ORDER BY Total_Maintenance_Cost DESC, cs.Station_ID ASC
    `;

    const [rows] = await pool.query(query, [ownerId]);

    const totalMaintenanceCost = rows.reduce((sum, r) => sum + parseFloat(r.Total_Maintenance_Cost || 0), 0);

    res.json({
      success: true,
      report: 'Maintenance Cost per Station',
      totals: {
        total_maintenance_cost: parseFloat(totalMaintenanceCost.toFixed(2))
      },
      count: rows.length,
      data: rows
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/reports/summary
 * Overall summary totals limited to owner's stations
 */
router.get('/summary', async (req, res, next) => {
  try {
    const ownerId = req.user.id;

    // 1. Station count
    const [[stationsCount]] = await pool.query(
      'SELECT COUNT(*) AS total_stations FROM charging_station WHERE (Owner_User_ID = ? OR Owner_User_ID IS NULL)',
      [ownerId]
    );

    // 2. Charger counts
    const [[chargersSummary]] = await pool.query(
      `SELECT 
        COUNT(*) AS total_chargers,
        SUM(CASE WHEN cp.Availability_Status = 'Available' THEN 1 ELSE 0 END) AS available_chargers,
        SUM(CASE WHEN cp.Availability_Status = 'Occupied' THEN 1 ELSE 0 END) AS occupied_chargers,
        SUM(CASE WHEN cp.Availability_Status = 'Maintenance' THEN 1 ELSE 0 END) AS maintenance_chargers
      FROM charging_point cp
      JOIN charging_station cs ON cp.Station_ID = cs.Station_ID
      WHERE (cs.Owner_User_ID = ? OR cs.Owner_User_ID IS NULL)`,
      [ownerId]
    );

    // 3. Employees count
    const [[employeesCount]] = await pool.query(
      `SELECT COUNT(*) AS total_employees 
       FROM employee e
       JOIN charging_station cs ON e.Station_ID = cs.Station_ID
       WHERE (cs.Owner_User_ID = ? OR cs.Owner_User_ID IS NULL)`,
      [ownerId]
    );

    // 4. Booking stats
    const [[bookingsSummary]] = await pool.query(
      `SELECT 
        COUNT(*) AS total_bookings,
        SUM(CASE WHEN b.Booking_Status = 'Confirmed' THEN 1 ELSE 0 END) AS confirmed_bookings,
        SUM(CASE WHEN b.Booking_Status = 'Completed' THEN 1 ELSE 0 END) AS completed_bookings,
        SUM(CASE WHEN b.Booking_Status = 'Cancelled' THEN 1 ELSE 0 END) AS cancelled_bookings
      FROM booking b
      JOIN charging_point cp ON b.Charger_ID = cp.Charger_ID
      JOIN charging_station cs ON cp.Station_ID = cs.Station_ID
      WHERE (cs.Owner_User_ID = ? OR cs.Owner_User_ID IS NULL)`,
      [ownerId]
    );

    // 5. Session stats
    const [[sessionsSummary]] = await pool.query(
      `SELECT 
        COUNT(*) AS total_sessions,
        SUM(CASE WHEN sess.Session_End IS NULL THEN 1 ELSE 0 END) AS active_sessions,
        SUM(CASE WHEN sess.Session_End IS NOT NULL THEN 1 ELSE 0 END) AS completed_sessions,
        COALESCE(ROUND(SUM(sess.Energy_Consumed), 2), 0.00) AS total_energy_consumed_kwh,
        COALESCE(ROUND(SUM(sess.Charging_Cost), 2), 0.00) AS total_charging_cost
      FROM charging_session sess
      JOIN booking b ON sess.Booking_ID = b.Booking_ID
      JOIN charging_point cp ON b.Charger_ID = cp.Charger_ID
      JOIN charging_station cs ON cp.Station_ID = cs.Station_ID
      WHERE (cs.Owner_User_ID = ? OR cs.Owner_User_ID IS NULL)`,
      [ownerId]
    );

    // 6. Payment stats
    const [[paymentsSummary]] = await pool.query(
      `SELECT 
        COUNT(*) AS total_payments,
        COALESCE(ROUND(SUM(CASE WHEN p.Payment_Status = 'Paid' THEN p.Amount ELSE 0 END), 2), 0.00) AS total_revenue_paid,
        COALESCE(ROUND(SUM(p.Amount), 2), 0.00) AS total_payment_volume
      FROM payment p
      JOIN charging_session sess ON p.Session_ID = sess.Session_ID
      JOIN booking b ON sess.Booking_ID = b.Booking_ID
      JOIN charging_point cp ON b.Charger_ID = cp.Charger_ID
      JOIN charging_station cs ON cp.Station_ID = cs.Station_ID
      WHERE (cs.Owner_User_ID = ? OR cs.Owner_User_ID IS NULL)`,
      [ownerId]
    );

    // 7. Maintenance stats
    const [[maintenanceSummary]] = await pool.query(
      `SELECT 
        COUNT(*) AS total_maintenance_records,
        SUM(CASE WHEN m.Status = 'In Progress' THEN 1 ELSE 0 END) AS in_progress_maintenance,
        SUM(CASE WHEN m.Status = 'Completed' THEN 1 ELSE 0 END) AS completed_maintenance,
        COALESCE(ROUND(SUM(m.Cost), 2), 0.00) AS total_maintenance_cost
      FROM maintenance m
      JOIN charging_point cp ON m.Charger_ID = cp.Charger_ID
      JOIN charging_station cs ON cp.Station_ID = cs.Station_ID
      WHERE (cs.Owner_User_ID = ? OR cs.Owner_User_ID IS NULL)`,
      [ownerId]
    );

    const totalRevenue = parseFloat(paymentsSummary.total_revenue_paid || 0);
    const totalMaintenanceCost = parseFloat(maintenanceSummary.total_maintenance_cost || 0);
    const netOperatingProfit = parseFloat((totalRevenue - totalMaintenanceCost).toFixed(2));

    res.json({
      success: true,
      report: 'Platform Summary Totals',
      data: {
        stations: {
          total: stationsCount.total_stations
        },
        chargers: {
          total: chargersSummary.total_chargers,
          available: chargersSummary.available_chargers,
          occupied: chargersSummary.occupied_chargers,
          maintenance: chargersSummary.maintenance_chargers
        },
        users: {
          total_employees: employeesCount.total_employees
        },
        bookings: {
          total: bookingsSummary.total_bookings,
          confirmed: bookingsSummary.confirmed_bookings,
          completed: bookingsSummary.completed_bookings,
          cancelled: bookingsSummary.cancelled_bookings
        },
        sessions: {
          total: sessionsSummary.total_sessions,
          active: sessionsSummary.active_sessions,
          completed: sessionsSummary.completed_sessions,
          total_energy_kwh: parseFloat(sessionsSummary.total_energy_consumed_kwh || 0)
        },
        financials: {
          total_revenue: totalRevenue,
          total_maintenance_cost: totalMaintenanceCost,
          net_operating_profit: netOperatingProfit,
          currency: 'INR'
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
