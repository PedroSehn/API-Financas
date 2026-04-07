const authService = require('./auth.service');

async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email e senha são obrigatórios' });
  }

  try {
    const data = await authService.login(email, password);
    res.status(200).json({ data });
  } catch (err) {
    res.status(401).json({ message: err.message });
  }
}

module.exports = { login };
