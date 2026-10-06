/**
 * Custom Application Error class for controlled HTTP error responses
 */
class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Bad Request', details = null) {
    return new AppError(message, 400, details);
  }

  static notFound(message = 'Resource Not Found', details = null) {
    return new AppError(message, 404, details);
  }

  static conflict(message = 'Conflict', details = null) {
    return new AppError(message, 409, details);
  }

  static internal(message = 'Internal Server Error', details = null) {
    return new AppError(message, 500, details);
  }
}

/**
 * 404 Not Found Middleware for unmatched routes
 */
function notFoundHandler(req, res, next) {
  res.status(404).json({
    success: false,
    error: {
      status: 404,
      message: `Endpoint not found: ${req.method} ${req.originalUrl}`
    }
  });
}

/**
 * Central Error Handler Middleware
 * Maps MySQL errors (foreign keys, duplicates, data truncation) to appropriate HTTP status codes
 */
function errorHandler(err, req, res, next) {
  // If headers already sent, delegate to default Express handler
  if (res.headersSent) {
    return next(err);
  }

  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let details = err.details || null;
  let errorCode = err.code || null;

  // Handle JSON parsing syntax error
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    message = 'Invalid JSON payload in request body';
  }

  // Handle MySQL Errors
  if (err.code || err.errno) {
    errorCode = err.code;

    switch (err.code) {
      // 1062: Duplicate entry for key
      case 'ER_DUP_ENTRY':
        statusCode = 409;
        message = 'Conflict: Duplicate entry for unique key.';
        details = err.sqlMessage || err.message;
        break;

      // 1452: Cannot add or update a child row: foreign key constraint fails
      case 'ER_NO_REFERENCED_ROW':
      case 'ER_NO_REFERENCED_ROW_2':
        statusCode = 400;
        message = 'Bad Request: Referenced entity does not exist (Foreign Key Constraint Failed).';
        details = err.sqlMessage || err.message;
        break;

      // 1451: Cannot delete or update a parent row: a foreign key constraint fails
      case 'ER_ROW_IS_REFERENCED':
      case 'ER_ROW_IS_REFERENCED_2':
        statusCode = 409;
        message = 'Conflict: Cannot delete or modify resource because it is referenced by other records.';
        details = err.sqlMessage || err.message;
        break;

      // 1406: Data too long for column
      case 'ER_DATA_TOO_LONG':
        statusCode = 400;
        message = 'Bad Request: Data value exceeds maximum allowed length.';
        details = err.sqlMessage || err.message;
        break;

      // 1265: Data truncated or 1366: Incorrect integer/decimal value
      case 'WARN_DATA_TRUNCATED':
      case 'ER_TRUNCATED_WRONG_VALUE':
      case 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD':
        statusCode = 400;
        message = 'Bad Request: Data truncated or invalid column value type.';
        details = err.sqlMessage || err.message;
        break;

      // 1048: Column cannot be null
      case 'ER_BAD_NULL_ERROR':
        statusCode = 400;
        message = 'Bad Request: Required field cannot be null.';
        details = err.sqlMessage || err.message;
        break;

      // 1054: Unknown column
      case 'ER_BAD_FIELD_ERROR':
        statusCode = 400;
        message = 'Bad Request: Unknown column in query or payload.';
        details = err.sqlMessage || err.message;
        break;

      // Connection issues
      case 'ECONNREFUSED':
      case 'PROTOCOL_CONNECTION_LOST':
      case 'ER_CON_COUNT_ERROR':
        statusCode = 503;
        message = 'Service Unavailable: Unable to connect to the database.';
        details = 'Please ensure the MySQL database server is running and accessible.';
        break;

      default:
        // Other SQL errors
        if (err.errno && !err.statusCode) {
          statusCode = 500;
          message = 'Database operation failed.';
          details = process.env.NODE_ENV === 'production' ? null : err.sqlMessage;
        }
        break;
    }
  }

  // Log server errors for observability
  if (statusCode >= 500) {
    console.error(`[Error 500] ${req.method} ${req.originalUrl}:`, err);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      status: statusCode,
      code: errorCode,
      message,
      ...(details ? { details } : {})
    }
  });
}

module.exports = {
  AppError,
  errorHandler,
  notFoundHandler
};
