const incomesService = require('./incomes.service');

async function getByMonth(req, res) {
  const { year, month } = req.query;
  if (!year || !month) return res.status(400).json({ message: 'year e month são obrigatórios' });

  const data = await incomesService.getByMonth(req.user.id, parseInt(year), parseInt(month));
  res.status(200).json({ data });
}

async function create(req, res) {
  const { label, value, type, start_month, start_year } = req.body;
  if (!label || !value || !type || !start_month || !start_year) {
    return res.status(400).json({ message: 'label, value, type, start_month e start_year são obrigatórios' });
  }

  const VALID_TYPES = ['salary', 'vr', 'extra'];
  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ message: 'type deve ser salary, vr ou extra' });
  }

  const data = await incomesService.create(req.user.id, req.body);
  res.status(201).json({ data });
}

async function update(req, res) {
  const { label, value, type, start_month, start_year } = req.body;
  if (!label || !value || !type || !start_month || !start_year) {
    return res.status(400).json({ message: 'label, value, type, start_month e start_year são obrigatórios' });
  }

  const VALID_TYPES = ['salary', 'vr', 'extra'];
  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ message: 'type deve ser salary, vr ou extra' });
  }

  const data = await incomesService.update(req.user.id, req.params.id, req.body);
  if (!data) return res.status(404).json({ message: 'Ganho não encontrado' });
  res.status(200).json({ data });
}

async function remove(req, res) {
  const deleted = await incomesService.remove(req.user.id, req.params.id);
  if (!deleted) return res.status(404).json({ message: 'Ganho não encontrado' });
  res.status(200).json({ message: 'Ganho removido com sucesso' });
}

module.exports = { getByMonth, create, update, remove };
