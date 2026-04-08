const expensesService = require('./expenses.service');

async function getByMonth(req, res) {
  const { year, month } = req.query;
  if (!year || !month) return res.status(400).json({ message: 'year e month são obrigatórios' });

  const data = await expensesService.getByMonth(req.user.id, parseInt(year), parseInt(month));
  res.status(200).json({ data });
}

async function create(req, res) {
  const { label, value, start_month, start_year } = req.body;
  if (!label || !value || !start_month || !start_year) {
    return res.status(400).json({ message: 'label, value, start_month e start_year são obrigatórios' });
  }

  const data = await expensesService.create(req.user.id, req.body);
  res.status(201).json({ data });
}

async function update(req, res) {
  const { label, value, start_month, start_year } = req.body;
  if (!label || !value || !start_month || !start_year) {
    return res.status(400).json({ message: 'label, value, start_month e start_year são obrigatórios' });
  }

  const data = await expensesService.update(req.user.id, req.params.id, req.body);
  if (!data) return res.status(404).json({ message: 'Despesa não encontrada' });
  res.status(200).json({ data });
}

async function remove(req, res) {
  const deleted = await expensesService.remove(req.user.id, req.params.id);
  if (!deleted) return res.status(404).json({ message: 'Despesa não encontrada' });
  res.status(200).json({ message: 'Despesa removida com sucesso' });
}

module.exports = { getByMonth, create, update, remove };
