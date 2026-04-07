const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../../config/database');

async function login(email, password) {
  const { rows } = await pool.query(
    'SELECT id, name, email, password_hash, is_demo FROM users WHERE email = $1',
    [email]
  );

  const user = rows[0];

  if (!user) throw new Error('Credenciais inválidas');

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new Error('Credenciais inválidas');

  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, is_demo: user.is_demo },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );

  return {
    token,
    user: { id: user.id, name: user.name, email: user.email, is_demo: user.is_demo },
  };
}

module.exports = { login };
