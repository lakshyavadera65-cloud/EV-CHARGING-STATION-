const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');

// Load environment configuration
dotenv.config();

const { testConnection, pool } = require('./src/db');
const { errorHandler, notFoundHandler } = require('./src/errorHandler');

// Route modules
const healthRouter = require('./src/routes/health');
const authRouter = require('./src/routes/auth');
const stationsRouter = require('./src/routes/stations');
const chargersRouter = require('./src/routes/chargers');
const customersRouter = require('./src/routes/customers');
const employeesRouter = require('./src/routes/employees');
const bookingsRouter = require('./src/routes/bookings');
const sessionsRouter = require('./src/routes/sessions');
const paymentsRouter = require('./src/routes/payments');
const maintenanceRouter = require('./src/routes/maintenance');
const reportsRouter = require('./src/routes/reports');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 5000;

// Global Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging (skip in test environment if needed)
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));
}

// Root route - API directory
app.get('/', (req, res) => {
  res.json({
    name: 'EV Charging Station Management System API',
    version: '1.1.0',
    documentation: '/api/health',
    endpoints: {
      health: '/api/health',
      auth: {
        register_customer: '/api/auth/register/customer',
        register_owner: '/api/auth/register/owner',
        login: '/api/auth/login',
        me: '/api/auth/me'
      },
      stations: '/api/stations',
      chargers: '/api/chargers',
      customers: '/api/customers',
      employees: '/api/employees',
      bookings: '/api/bookings',
      sessions: '/api/sessions',
      payments: '/api/payments',
      maintenance: '/api/maintenance',
      reports: {
        revenue_by_station: '/api/reports/revenue-by-station',
        customer_energy_usage: '/api/reports/customer-energy-usage',
        maintenance_cost_by_station: '/api/reports/maintenance-cost-by-station',
        summary: '/api/reports/summary'
      }
    }
  });
});

// Mount Resource Routes under /api/...
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/stations', stationsRouter);
app.use('/api/chargers', chargersRouter);
app.use('/api/customers', customersRouter);
app.use('/api/employees', employeesRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/maintenance', maintenanceRouter);
app.use('/api/reports', reportsRouter);

// 404 Handler for undefined routes
app.use(notFoundHandler);

// Centralized MySQL and Application Error Handler
app.use(errorHandler);

// Start Server
if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(PORT, async () => {
    console.log(`\n======================================================`);
    console.log(`⚡ EV Charging Station API running on port ${PORT}`);
    console.log(`📡 URL: http://localhost:${PORT}`);
    console.log(`🏥 Health Check: http://localhost:${PORT}/api/health`);
    console.log(`======================================================\n`);

    // Verify DB connection on startup
    try {
      await testConnection();
      console.log('✅ Connected to MySQL database successfully.');
    } catch (err) {
      console.warn('⚠️  Warning: MySQL connection could not be established on startup.');
      console.warn(`   Check your .env settings: host=${process.env.DB_HOST}, user=${process.env.DB_USER}, db=${process.env.DB_NAME}`);
      console.warn(`   Error details: ${err.message}`);
    }
  });

  // Graceful shutdown
  const gracefulShutdown = () => {
    console.log('\nReceived kill signal, shutting down gracefully...');
    server.close(async () => {
      console.log('Closed out remaining connections.');
      try {
        await pool.end();
        console.log('Database pool closed.');
      } catch (e) {
        console.error('Error closing pool:', e.message);
      }
      process.exit(0);
    });
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
}

module.exports = app;
