const dashboardService = require('./dashboard.service');

async function getByMonth(req, res) {
  const { year, month } = req.query;
  if (!year || !month) return res.status(400).json({ message: 'year e month são obrigatórios' });

  const data = await dashboardService.getByMonth(req.user.id, parseInt(year), parseInt(month));
  res.status(200).json({ data });
}

module.exports = { getByMonth };
