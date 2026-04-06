const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.connect()
  .then(() => console.log('PostgreSQL conectado'))
  .catch((err) => console.error('Erro ao conectar no banco:', err));

module.exports = pool;