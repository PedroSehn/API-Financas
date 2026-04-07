require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./src/config/database');

const SALT_ROUNDS = 10;

const users = [
  { name: 'Pedro', email: 'pedro@financas.com', password: 'pedro123', is_demo: false },
  { name: 'Gabi',  email: 'gabi@financas.com',  password: 'gabi123',  is_demo: false },
  { name: 'DEMO',  email: 'demo@financas.com',   password: 'demo123',  is_demo: true  },
];

async function seed() {
  for (const user of users) {
    const password_hash = await bcrypt.hash(user.password, SALT_ROUNDS);

    await pool.query(
      `INSERT INTO users (name, email, password_hash, is_demo)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING`,
      [user.name, user.email, password_hash, user.is_demo]
    );

    console.log(`Usuário "${user.name}" criado (${user.email})`);
  }

  await pool.end();
  console.log('\nSeed concluído.');
}

seed().catch((err) => {
  console.error('Erro no seed:', err);
  pool.end();
  process.exit(1);
});
