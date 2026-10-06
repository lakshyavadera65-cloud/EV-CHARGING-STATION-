const express = require('express');
const { pool } = require('./db');
const { AppError } = require('./errorHandler');

/**
 * Creates reusable parameterized CRUD handler functions and an Express Router
 * for standard entity tables.
 *
 * @param {Object} options
 * @param {string} options.table - Name of the MySQL table
 * @param {string} options.primaryKey - Primary key column name
 * @param {string[]} options.allowedFields - Fields that can be inserted/updated
 * @param {string[]} [options.requiredFields=[]] - Fields required on create
 * @param {string[]} [options.searchFields=[]] - Fields to filter by via query params
 * @param {string} [options.customSelect] - Optional custom SELECT clause with JOINs
 * @param {string} [options.defaultSort] - Default ORDER BY clause
 * @param {Function} [options.beforeCreate] - Hook before create: async (body, connection)
 * @param {Function} [options.beforeUpdate] - Hook before update: async (id, body, existing)
 * @param {Function} [options.beforeDelete] - Hook before delete: async (id, existing)
 */
function createCrudRouter(options) {
  const {
    table,
    primaryKey,
    allowedFields,
    requiredFields = [],
    searchFields = [],
    customSelect = null,
    defaultSort = `${primaryKey} ASC`,
    beforeCreate = null,
    beforeUpdate = null,
    beforeDelete = null
  } = options;

  const router = express.Router();

  // 1. GET / - List all records (supports parameterized filtering)
  router.get('/', async (req, res, next) => {
    try {
      let query;
      const queryParams = [];
      const whereClauses = [];

      if (customSelect) {
        query = customSelect;
      } else {
        query = `SELECT * FROM \`${table}\``;
      }

      // Allow filtering by searchFields if provided in req.query
      for (const field of searchFields) {
        if (req.query[field] !== undefined && req.query[field] !== '') {
          whereClauses.push(`\`${table}\`.\`${field}\` = ?`);
          queryParams.push(req.query[field]);
        }
      }

      if (whereClauses.length > 0) {
        query += ` WHERE ${whereClauses.join(' AND ')}`;
      }

      if (defaultSort) {
        query += ` ORDER BY ${defaultSort}`;
      }

      const [rows] = await pool.query(query, queryParams);
      res.json({
        success: true,
        count: rows.length,
        data: rows
      });
    } catch (error) {
      next(error);
    }
  });

  // 2. GET /:id - Get single record by primary key
  router.get('/:id', async (req, res, next) => {
    try {
      const id = req.params.id;
      let query;

      if (customSelect) {
        query = `${customSelect} WHERE \`${table}\`.\`${primaryKey}\` = ?`;
      } else {
        query = `SELECT * FROM \`${table}\` WHERE \`${primaryKey}\` = ?`;
      }

      const [rows] = await pool.query(query, [id]);
      if (rows.length === 0) {
        throw AppError.notFound(`${table.replace(/_/g, ' ')} with ID ${id} not found`);
      }

      res.json({
        success: true,
        data: rows[0]
      });
    } catch (error) {
      next(error);
    }
  });

  // 3. POST / - Create a new record
  router.post('/', async (req, res, next) => {
    try {
      const body = req.body;

      // Validate required fields
      for (const field of requiredFields) {
        if (body[field] === undefined || body[field] === null || body[field] === '') {
          throw AppError.badRequest(`Missing required field: ${field}`);
        }
      }

      if (beforeCreate) {
        await beforeCreate(body);
      }

      // Filter only allowed fields
      const insertData = {};
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          insertData[field] = body[field];
        }
      }

      const columns = Object.keys(insertData);
      if (columns.length === 0) {
        throw AppError.badRequest('No valid fields provided for insertion');
      }

      const placeholders = columns.map(() => '?').join(', ');
      const values = columns.map(col => insertData[col]);
      const columnNames = columns.map(col => `\`${col}\``).join(', ');

      const insertSql = `INSERT INTO \`${table}\` (${columnNames}) VALUES (${placeholders})`;
      const [result] = await pool.query(insertSql, values);

      // Fetch the created record
      const [createdRows] = await pool.query(
        `SELECT * FROM \`${table}\` WHERE \`${primaryKey}\` = ?`,
        [result.insertId]
      );

      res.status(201).json({
        success: true,
        message: `${table.replace(/_/g, ' ')} created successfully`,
        data: createdRows[0]
      });
    } catch (error) {
      next(error);
    }
  });

  // 4. PUT /:id - Update an existing record
  router.put('/:id', async (req, res, next) => {
    try {
      const id = req.params.id;
      const body = req.body;

      // Check if record exists
      const [existing] = await pool.query(
        `SELECT * FROM \`${table}\` WHERE \`${primaryKey}\` = ?`,
        [id]
      );

      if (existing.length === 0) {
        throw AppError.notFound(`${table.replace(/_/g, ' ')} with ID ${id} not found`);
      }

      if (beforeUpdate) {
        await beforeUpdate(id, body, existing[0]);
      }

      // Filter allowed fields present in body
      const updateData = {};
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updateData[field] = body[field];
        }
      }

      const columns = Object.keys(updateData);
      if (columns.length === 0) {
        throw AppError.badRequest('No valid fields provided for update');
      }

      const setClauses = columns.map(col => `\`${col}\` = ?`).join(', ');
      const values = [...columns.map(col => updateData[col]), id];

      const updateSql = `UPDATE \`${table}\` SET ${setClauses} WHERE \`${primaryKey}\` = ?`;
      await pool.query(updateSql, values);

      // Fetch updated record
      const [updatedRows] = await pool.query(
        `SELECT * FROM \`${table}\` WHERE \`${primaryKey}\` = ?`,
        [id]
      );

      res.json({
        success: true,
        message: `${table.replace(/_/g, ' ')} updated successfully`,
        data: updatedRows[0]
      });
    } catch (error) {
      next(error);
    }
  });

  // 5. DELETE /:id - Delete a record
  router.delete('/:id', async (req, res, next) => {
    try {
      const id = req.params.id;

      // Check if record exists
      const [existing] = await pool.query(
        `SELECT * FROM \`${table}\` WHERE \`${primaryKey}\` = ?`,
        [id]
      );

      if (existing.length === 0) {
        throw AppError.notFound(`${table.replace(/_/g, ' ')} with ID ${id} not found`);
      }

      if (beforeDelete) {
        await beforeDelete(id, existing[0]);
      }

      const deleteSql = `DELETE FROM \`${table}\` WHERE \`${primaryKey}\` = ?`;
      await pool.query(deleteSql, [id]);

      res.json({
        success: true,
        message: `${table.replace(/_/g, ' ')} with ID ${id} deleted successfully`
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

/**
 * Generic query helper to find all records with optional filters
 */
async function findAll(table, filters = {}, sort = null) {
  let query = `SELECT * FROM \`${table}\``;
  const params = [];
  const clauses = [];

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') {
      clauses.push(`\`${key}\` = ?`);
      params.push(value);
    }
  }

  if (clauses.length > 0) {
    query += ` WHERE ${clauses.join(' AND ')}`;
  }

  if (sort) {
    query += ` ORDER BY ${sort}`;
  }

  const [rows] = await pool.query(query, params);
  return rows;
}

/**
 * Generic query helper to find single record by primary key
 */
async function findById(table, primaryKey, id) {
  const [rows] = await pool.query(
    `SELECT * FROM \`${table}\` WHERE \`${primaryKey}\` = ?`,
    [id]
  );
  return rows[0] || null;
}

/**
 * Generic query helper to create a record with parameterized values
 */
async function createOne(table, data) {
  const columns = Object.keys(data);
  const values = Object.values(data);
  const placeholders = columns.map(() => '?').join(', ');
  const columnNames = columns.map(c => `\`${c}\``).join(', ');

  const sql = `INSERT INTO \`${table}\` (${columnNames}) VALUES (${placeholders})`;
  const [result] = await pool.query(sql, values);
  return result.insertId;
}

/**
 * Generic query helper to update a record with parameterized values
 */
async function updateOne(table, primaryKey, id, data) {
  const columns = Object.keys(data);
  const values = Object.values(data);
  const setClause = columns.map(c => `\`${c}\` = ?`).join(', ');

  const sql = `UPDATE \`${table}\` SET ${setClause} WHERE \`${primaryKey}\` = ?`;
  const [result] = await pool.query(sql, [...values, id]);
  return result.affectedRows > 0;
}

/**
 * Generic query helper to delete a record
 */
async function deleteOne(table, primaryKey, id) {
  const sql = `DELETE FROM \`${table}\` WHERE \`${primaryKey}\` = ?`;
  const [result] = await pool.query(sql, [id]);
  return result.affectedRows > 0;
}

module.exports = {
  createCrudRouter,
  findAll,
  findById,
  createOne,
  updateOne,
  deleteOne
};

