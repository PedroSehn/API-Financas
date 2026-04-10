const { Pool } = require('pg');
require('dotenv').config();
console.log('DATABASE_URL recebida:', process.env.DATABASE_URL);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.connect()
  .then(() => console.log('PostgreSQL conectado'))
  .catch((err) => console.error('Erro ao conectar no banco:', err));

module.exports = pool;