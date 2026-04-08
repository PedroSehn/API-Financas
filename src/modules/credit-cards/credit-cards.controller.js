const service = require('./credit-cards.service');

async function getAll(req, res) {
  const data = await service.getAll(req.user.id);
  res.status(200).json({ data });
}

async function create(req, res) {
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: 'name é obrigatório' });

  const data = await service.create(req.user.id, req.body);
  res.status(201).json({ data });
}

async function update(req, res) {
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: 'name é obrigatório' });

  const data = await service.update(req.user.id, req.params.id, req.body);
  if (!data) return res.status(404).json({ message: 'Cartão não encontrado' });
  res.status(200).json({ data });
}

async function remove(req, res) {
  const deleted = await service.remove(req.user.id, req.params.id);
  if (!deleted) return res.status(404).json({ message: 'Cartão não encontrado' });
  res.status(200).json({ message: 'Cartão removido com sucesso' });
}

async function getTransactionsByMonth(req, res) {
  const { year, month } = req.query;
  if (!year || !month) return res.status(400).json({ message: 'year e month são obrigatórios' });

  const data = await service.getTransactionsByMonth(
    req.user.id,
    req.params.cardId,
    parseInt(year),
    parseInt(month)
  );
  res.status(200).json({ data });
}

async function createTransaction(req, res) {
  const { description, value, date, start_month, start_year } = req.body;
  if (!description || !value || !date || !start_month || !start_year) {
    return res.status(400).json({ message: 'description, value, date, start_month e start_year são obrigatórios' });
  }

  const data = await service.createTransaction(req.user.id, req.params.cardId, req.body);
  if (!data) return res.status(404).json({ message: 'Cartão não encontrado' });
  res.status(201).json({ data });
}

async function updateTransaction(req, res) {
  const { description, value, date, start_month, start_year } = req.body;
  if (!description || !value || !date || !start_month || !start_year) {
    return res.status(400).json({ message: 'description, value, date, start_month e start_year são obrigatórios' });
  }

  const data = await service.updateTransaction(req.user.id, req.params.cardId, req.params.id, req.body);
  if (!data) return res.status(404).json({ message: 'Transação não encontrada' });
  res.status(200).json({ data });
}

async function removeTransaction(req, res) {
  const deleted = await service.removeTransaction(req.user.id, req.params.cardId, req.params.id);
  if (!deleted) return res.status(404).json({ message: 'Transação não encontrada' });
  res.status(200).json({ message: 'Transação removida com sucesso' });
}

async function getMonthlyTotals(req, res) {
  const { year } = req.query;
  if (!year) return res.status(400).json({ message: 'year é obrigatório' });

  const data = await service.getMonthlyTotals(req.user.id, req.params.cardId, parseInt(year));
  if (!data) return res.status(404).json({ message: 'Cartão não encontrado' });
  res.status(200).json({ data });
}

module.exports = { getAll, create, update, remove, getTransactionsByMonth, getMonthlyTotals, createTransaction, updateTransaction, removeTransaction };
