const pool = require('../../config/database');
const { monthFilter } = require('../../utils/monthFilter');

async function getByMonth(userId, year, month) {
  const filter = monthFilter('$2', '$3');
  const { rows } = await pool.query(
    `SELECT * FROM incomes
     WHERE user_id = $1
       AND ${filter.sql}
     ORDER BY created_at ASC`,
    [userId, year, month]
  );
  return rows;
}

async function getById(userId, id) {
  const { rows } = await pool.query(
    'SELECT * FROM incomes WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  return rows[0] || null;
}

async function create(userId, { label, emoji, value, type, start_month, start_year, duration_months }) {
  const { rows } = await pool.query(
    `INSERT INTO incomes (user_id, label, emoji, value, type, start_month, start_year, duration_months)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [userId, label, emoji ?? null, value, type, start_month, start_year, duration_months ?? 1]
  );
  return rows[0];
}

async function update(userId, id, { label, emoji, value, type, start_month, start_year, duration_months }) {
  const { rows } = await pool.query(
    `UPDATE incomes
     SET label = $3, emoji = $4, value = $5, type = $6,
         start_month = $7, start_year = $8, duration_months = $9
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [id, userId, label, emoji ?? null, value, type, start_month, start_year, duration_months ?? 1]
  );
  return rows[0] || null;
}

async function remove(userId, id) {
  const { rowCount } = await pool.query(
    'DELETE FROM incomes WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  return rowCount > 0;
}

module.exports = { getByMonth, getById, create, update, remove };
