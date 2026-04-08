const salaryService     = require('../salary/salary.service');
const incomesService    = require('../incomes/incomes.service');
const expensesService   = require('../expenses/expenses.service');
const creditCardsService = require('../credit-cards/credit-cards.service');

async function getByMonth(userId, year, month) {
  const [salary, incomes, expenses, cards] = await Promise.all([
    salaryService.getByUser(userId),
    incomesService.getByMonth(userId, year, month),
    expensesService.getByMonth(userId, year, month),
    creditCardsService.getAll(userId),
  ]);

  const creditCards = await Promise.all(
    cards.map(async (card) => {
      const transactions = await creditCardsService.getTransactionsByMonth(userId, card.id, year, month);
      const month_total  = transactions.reduce((s, t) => s + parseFloat(t.value), 0);
      return { ...card, transactions, month_total: Math.round(month_total * 100) / 100 };
    })
  );

  const netSalary     = salary ? salary.calculated.net : 0;
  const incomesTotal  = incomes.reduce((s, r) => s + parseFloat(r.value), 0);
  const expensesTotal = expenses.reduce((s, r) => s + parseFloat(r.value), 0);
  const cardsTotal    = creditCards.reduce((s, c) => s + c.month_total, 0);
  const totalIncome   = Math.round((netSalary + incomesTotal)  * 100) / 100;
  const totalExpenses = Math.round(expensesTotal               * 100) / 100;
  const totalCards    = Math.round(cardsTotal                  * 100) / 100;
  const balance       = Math.round((totalIncome - totalExpenses - totalCards) * 100) / 100;

  return {
    month,
    year,
    salary: salary
      ? { gross: parseFloat(salary.gross_salary), net: salary.calculated.net, total_discounts: salary.calculated.total_discounts }
      : null,
    incomes,
    expenses,
    credit_cards: creditCards,
    summary: { total_income: totalIncome, total_expenses: totalExpenses, total_credit_cards: totalCards, balance },
  };
}

module.exports = { getByMonth };
