const pool = require('../../config/database');
const incomesService = require('../incomes/incomes.service');
const expensesService = require('../expenses/expenses.service');
const salaryService = require('../salary/salary.service');

async function getCardsTotalForMonth(userId, year, month) {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(ct.value), 0) AS total
     FROM card_transactions ct
     JOIN credit_cards cc ON cc.id = ct.credit_card_id
     WHERE cc.user_id = $1
       AND (ct.start_year * 12 + ct.start_month)                          <= ($2 * 12 + $3)
       AND (ct.start_year * 12 + ct.start_month + ct.duration_months - 1) >= ($2 * 12 + $3)`,
    [userId, year, month]
  );
  return rows[0].total;
}

async function simulate(userId, { value, duration_months, start_month, start_year }) {
  const months = Math.min(duration_months, 12);
  const result = [];

  const salary = await salaryService.getByUser(userId);
  const netSalary = salary ? salary.calculated.net : 0;

  for (let i = 0; i < months; i++) {
    const totalMonths = start_year * 12 + start_month - 1 + i;
    const year  = Math.floor(totalMonths / 12);
    const month = (totalMonths % 12) + 1;

    const [incomes, expenses, cardTotal] = await Promise.all([
      incomesService.getByMonth(userId, year, month),
      expensesService.getByMonth(userId, year, month),
      getCardsTotalForMonth(userId, year, month),
    ]);

    const income  = netSalary + incomes.reduce((s, r) => s + parseFloat(r.value), 0);
    const expense = expenses.reduce((s, r) => s + parseFloat(r.value), 0);
    const card    = parseFloat(cardTotal);
    const balance = Math.round((income - expense - card) * 100) / 100;

    result.push({
      month,
      year,
      income:                  Math.round(income  * 100) / 100,
      expenses:                Math.round(expense * 100) / 100,
      card_total:              Math.round(card    * 100) / 100,
      balance,
      installment:             parseFloat(value),
      balance_with_simulation: Math.round((balance - parseFloat(value)) * 100) / 100,
    });
  }

  return result;
}

module.exports = { simulate };
