const { Pool } = require('pg');

console.log('PGHOST:', process.env.PGHOST);
console.log('PGDATABASE:', process.env.PGDATABASE);
console.log('PGUSER:', process.env.POSTGRES_USER);

const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  database: process.env.PGDATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.PGPASSWORD,
});

pool.connect()
    .then(() => console.log('PostgreSQL conectado'))
    .catch((err) => console.error('Erro ao conectar no banco:', err));

module.exports = pool;