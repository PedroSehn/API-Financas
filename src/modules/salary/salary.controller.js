const salaryService = require('./salary.service');

async function get(req, res) {
  const data = await salaryService.getByUser(req.user.id);
  if (!data) return res.status(404).json({ message: 'Configuração de salário não encontrada' });
  res.status(200).json({ data });
}

async function create(req, res) {
  const { gross_salary } = req.body;
  if (!gross_salary) return res.status(400).json({ message: 'Salário bruto é obrigatório' });

  try {
    const data = await salaryService.create(req.user.id, req.body);
    res.status(201).json({ data });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'Configuração de salário já existe' });
    throw err;
  }
}

async function update(req, res) {
  const { gross_salary } = req.body;
  if (!gross_salary) return res.status(400).json({ message: 'Salário bruto é obrigatório' });

  const data = await salaryService.update(req.user.id, req.body);
  if (!data) return res.status(404).json({ message: 'Configuração de salário não encontrada' });
  res.status(200).json({ data });
}

module.exports = { get, create, update };
