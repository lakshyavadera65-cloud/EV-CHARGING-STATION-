const express = require('express');
const { pool } = require('../db');

const router = express.Router();

/**
 * GET /api/health
 * Checks server health and database connectivity
 */
router.get('/', async (req, res) => {
  const startTime = Date.now();

  try {
    const connection = await pool.getConnection();
    await connection.query('SELECT 1 AS alive');
    connection.release();

    const responseTimeMs = Date.now() - startTime;

    res.json({
      status: 'UP',
      timestamp: new Date().toISOString(),
      uptime_seconds: Math.floor(process.uptime()),
      database: {
        status: 'CONNECTED',
        name: process.env.DB_NAME || 'ev_charging_db',
        response_time_ms: responseTimeMs
      },
      environment: {
        node_version: process.version,
        rate_per_kwh: parseFloat(process.env.RATE_PER_KWH) || 12.00
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'DEGRADED',
      timestamp: new Date().toISOString(),
      uptime_seconds: Math.floor(process.uptime()),
      database: {
        status: 'DISCONNECTED',
        error: error.message
      }
    });
  }
});

module.exports = router;
