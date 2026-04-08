const simulationService = require('./simulation.service');

async function simulate(req, res) {
  const { value, duration_months, start_month, start_year } = req.body;
  if (!value || !duration_months || !start_month || !start_year) {
    return res.status(400).json({ message: 'value, duration_months, start_month e start_year são obrigatórios' });
  }

  const data = await simulationService.simulate(req.user.id, req.body);
  res.status(200).json({ data });
}

module.exports = { simulate };
