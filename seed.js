require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./src/config/database');

const SALT_ROUNDS = 10;

const users = [
  {
    name: 'Pedro', email: 'pedro@financas.com', password: 'pedro123', is_demo: false,
    salary: { gross_salary: 5000, has_inss: true, has_irrf: true, vt_percentage: 6, health_plan: 150, other_discounts: [] },
  },
  {
    name: 'Gabi',  email: 'gabi@financas.com',  password: 'gabi123',  is_demo: false,
    salary: { gross_salary: 3500, has_inss: true, has_irrf: true, vt_percentage: 6, health_plan: 0,   other_discounts: [] },
  },
  {
    name: 'DEMO',  email: 'demo@financas.com',   password: 'demo123',  is_demo: true,
    salary: { gross_salary: 4000, has_inss: true, has_irrf: true, vt_percentage: 6, health_plan: 100, other_discounts: [] },
  },
];

async function seed() {
  for (const user of users) {
    const password_hash = await bcrypt.hash(user.password, SALT_ROUNDS);

    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, is_demo)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [user.name, user.email, password_hash, user.is_demo]
    );

    const userId = rows[0].id;
    console.log(`Usuário "${user.name}" criado (${user.email})`);

    if (user.salary) {
      const s = user.salary;
      await pool.query(
        `DELETE FROM salary_config WHERE user_id = $1`,
        [userId]
      );
      await pool.query(
        `INSERT INTO salary_config (user_id, gross_salary, has_inss, has_irrf, vt_percentage, health_plan, other_discounts)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, s.gross_salary, s.has_inss, s.has_irrf, s.vt_percentage, s.health_plan, JSON.stringify(s.other_discounts)]
      );
      console.log(`  Salário configurado: R$ ${s.gross_salary}`);
    }
  }

  await pool.end();
  console.log('\nSeed concluído.');
}

seed().catch((err) => {
  console.error('Erro no seed:', err);
  pool.end();
  process.exit(1);
});
