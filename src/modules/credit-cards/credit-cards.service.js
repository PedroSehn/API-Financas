const pool = require('../../config/database');
const { monthFilter } = require('../../utils/monthFilter');

async function getAll(userId) {
  const { rows } = await pool.query(
    'SELECT * FROM credit_cards WHERE user_id = $1 ORDER BY created_at ASC',
    [userId]
  );
  return rows;
}

async function create(userId, { name, emoji, color }) {
  const { rows } = await pool.query(
    'INSERT INTO credit_cards (user_id, name, emoji, color) VALUES ($1, $2, $3, $4) RETURNING *',
    [userId, name, emoji ?? null, color ?? null]
  );
  return rows[0];
}

async function update(userId, id, { name, emoji, color }) {
  const { rows } = await pool.query(
    'UPDATE credit_cards SET name = $3, emoji = $4, color = $5 WHERE id = $1 AND user_id = $2 RETURNING *',
    [id, userId, name, emoji ?? null, color ?? null]
  );
  return rows[0] || null;
}

async function remove(userId, id) {
  const { rowCount } = await pool.query(
    'DELETE FROM credit_cards WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  return rowCount > 0;
}

async function getTransactionsByMonth(userId, cardId, year, month) {
  const filter = monthFilter('$3', '$4');
  const { rows } = await pool.query(
    `SELECT ct.* FROM card_transactions ct
     JOIN credit_cards cc ON cc.id = ct.credit_card_id
     WHERE cc.user_id = $1 AND ct.credit_card_id = $2
       AND ${filter.sql}
     ORDER BY ct.created_at ASC`,
    [userId, cardId, year, month]
  );
  return rows;
}

async function createTransaction(userId, cardId, { description, emoji, value, date, start_month, start_year, duration_months }) {
  const { rows } = await pool.query(
    `INSERT INTO card_transactions (credit_card_id, description, emoji, value, date, start_month, start_year, duration_months)
     SELECT $1, $2, $3, $4, $5, $6, $7, $8
     WHERE EXISTS (SELECT 1 FROM credit_cards WHERE id = $1 AND user_id = $9)
     RETURNING *`,
    [cardId, description, emoji ?? null, value, date, start_month, start_year, duration_months ?? 1, userId]
  );
  return rows[0] || null;
}

async function updateTransaction(userId, cardId, id, { description, emoji, value, date, start_month, start_year, duration_months }) {
  const { rows } = await pool.query(
    `UPDATE card_transactions ct SET
       description = $3, emoji = $4, value = $5, date = $6,
       start_month = $7, start_year = $8, duration_months = $9
     FROM credit_cards cc
     WHERE ct.id = $1
       AND ct.credit_card_id = $2
       AND cc.id = ct.credit_card_id
       AND cc.user_id = $10
     RETURNING ct.*`,
    [id, cardId, description, emoji ?? null, value, date, start_month, start_year, duration_months ?? 1, userId]
  );
  return rows[0] || null;
}

async function removeTransaction(userId, cardId, id) {
  const { rowCount } = await pool.query(
    `DELETE FROM card_transactions ct
     USING credit_cards cc
     WHERE ct.id = $1
       AND ct.credit_card_id = $2
       AND cc.id = ct.credit_card_id
       AND cc.user_id = $3`,
    [id, cardId, userId]
  );
  return rowCount > 0;
}

async function getMonthlyTotals(userId, cardId, year) {
  const { rows: cardRows } = await pool.query(
    'SELECT id FROM credit_cards WHERE id = $1 AND user_id = $2',
    [cardId, userId]
  );
  if (cardRows.length === 0) return null;

  const { rows } = await pool.query(
    `SELECT
       m.month,
       COALESCE(SUM(ct.value), 0) AS total
     FROM generate_series(1, 12) AS m(month)
     LEFT JOIN card_transactions ct
       ON ct.credit_card_id = $1
       AND (ct.start_year * 12 + ct.start_month)                          <= ($2 * 12 + m.month)
       AND (ct.start_year * 12 + ct.start_month + ct.duration_months - 1) >= ($2 * 12 + m.month)
     GROUP BY m.month
     ORDER BY m.month`,
    [cardId, year]
  );
  return rows;
}

module.exports = { getAll, create, update, remove, getTransactionsByMonth, getMonthlyTotals, createTransaction, updateTransaction, removeTransaction };
