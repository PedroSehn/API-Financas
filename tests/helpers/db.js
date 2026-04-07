const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../../src/config/database');

const TEST_USER = {
  name: 'Jest Test',
  email: 'jest_test@test.com',
  password: 'test123',
  is_demo: false,
};

const TEST_DEMO_USER = {
  name: 'Jest Demo',
  email: 'jest_demo@test.com',
  password: 'demo123',
  is_demo: true,
};

async function createTestUser() {
  const hash = await bcrypt.hash(TEST_USER.password, 10);
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash, is_demo)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
     RETURNING *`,
    [TEST_USER.name, TEST_USER.email, hash, TEST_USER.is_demo]
  );
  return rows[0];
}

async function createDemoUser() {
  const hash = await bcrypt.hash(TEST_DEMO_USER.password, 10);
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash, is_demo)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
     RETURNING *`,
    [TEST_DEMO_USER.name, TEST_DEMO_USER.email, hash, TEST_DEMO_USER.is_demo]
  );
  return rows[0];
}

async function cleanupTestUsers() {
  await pool.query(
    `DELETE FROM users WHERE email IN ($1, $2)`,
    [TEST_USER.email, TEST_DEMO_USER.email]
  );
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, is_demo: user.is_demo },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

module.exports = { TEST_USER, TEST_DEMO_USER, createTestUser, createDemoUser, cleanupTestUsers, generateToken };
