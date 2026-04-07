const pool = require('../../config/database');

// INSS 2024 progressive table
function calcINSS(gross) {
  const faixas = [
    { limit: 1412.00,  rate: 0.075 },
    { limit: 2666.68,  rate: 0.09  },
    { limit: 4000.03,  rate: 0.12  },
    { limit: 7786.02,  rate: 0.14  },
  ];

  let inss = 0;
  let prev = 0;

  for (const faixa of faixas) {
    if (gross <= prev) break;
    const base = Math.min(gross, faixa.limit) - prev;
    inss += base * faixa.rate;
    prev = faixa.limit;
  }

  return Math.round(inss * 100) / 100;
}

// IRRF 2024 table (applied on gross - INSS)
function calcIRRF(base) {
  if (base <= 2259.20)  return 0;
  if (base <= 2826.65)  return Math.round((base * 0.075 - 169.44)  * 100) / 100;
  if (base <= 3751.05)  return Math.round((base * 0.15  - 381.44)  * 100) / 100;
  if (base <= 4664.68)  return Math.round((base * 0.225 - 662.77)  * 100) / 100;
  return Math.round((base * 0.275 - 896.00) * 100) / 100;
}

function calculateNet(config) {
  const gross = parseFloat(config.gross_salary);

  const inss        = config.has_inss ? calcINSS(gross) : 0;
  const irrf        = config.has_irrf ? calcIRRF(gross - inss) : 0;
  const vt          = gross * (parseFloat(config.vt_percentage) / 100);
  const healthPlan  = parseFloat(config.health_plan);
  const others      = (config.other_discounts || []).reduce((sum, d) => sum + parseFloat(d.value), 0);

  const totalDiscounts = inss + irrf + vt + healthPlan + others;
  const net = Math.round((gross - totalDiscounts) * 100) / 100;

  return { inss, irrf, vt, health_plan: healthPlan, other_discounts_total: others, total_discounts: Math.round(totalDiscounts * 100) / 100, net };
}

async function getByUser(userId) {
  const { rows } = await pool.query(
    'SELECT * FROM salary_config WHERE user_id = $1',
    [userId]
  );

  if (!rows[0]) return null;

  const config = rows[0];
  return { ...config, calculated: calculateNet(config) };
}

async function create(userId, { gross_salary, has_inss, has_irrf, vt_percentage, health_plan, other_discounts }) {
  const { rows } = await pool.query(
    `INSERT INTO salary_config (user_id, gross_salary, has_inss, has_irrf, vt_percentage, health_plan, other_discounts)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [userId, gross_salary, has_inss ?? true, has_irrf ?? true, vt_percentage ?? 0, health_plan ?? 0, JSON.stringify(other_discounts ?? [])]
  );

  const config = rows[0];
  return { ...config, calculated: calculateNet(config) };
}

async function update(userId, { gross_salary, has_inss, has_irrf, vt_percentage, health_plan, other_discounts }) {
  const { rows } = await pool.query(
    `UPDATE salary_config
     SET gross_salary = $2, has_inss = $3, has_irrf = $4, vt_percentage = $5,
         health_plan = $6, other_discounts = $7, updated_at = NOW()
     WHERE user_id = $1
     RETURNING *`,
    [userId, gross_salary, has_inss ?? true, has_irrf ?? true, vt_percentage ?? 0, health_plan ?? 0, JSON.stringify(other_discounts ?? [])]
  );

  if (!rows[0]) return null;

  const config = rows[0];
  return { ...config, calculated: calculateNet(config) };
}

module.exports = { getByUser, create, update };
