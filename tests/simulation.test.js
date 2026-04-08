const request = require('supertest');
const pool = require('../src/config/database');
const app = require('../src/app');
const { createTestUser, cleanupTestUsers, generateToken } = require('./helpers/db');

let token;
let userId;

beforeAll(async () => {
  const user = await createTestUser();
  userId = user.id;
  token = generateToken(user);
});

afterAll(cleanupTestUsers);

afterEach(async () => {
  await Promise.all([
    pool.query('DELETE FROM incomes  WHERE user_id = $1', [userId]),
    pool.query('DELETE FROM expenses WHERE user_id = $1', [userId]),
    pool.query('DELETE FROM credit_cards WHERE user_id = $1', [userId]),
  ]);
});

const SIMULATION_BODY = {
  value: 500,
  duration_months: 3,
  start_month: 4,
  start_year: 2026,
  description: 'Novo celular',
};

// ─── VALIDATION ───────────────────────────────────────────────────────────────

describe('Simulação — POST /simulation', () => {
  it('retorna 400 quando campos obrigatórios estão ausentes', async () => {
    const res = await request(app)
      .post('/simulation')
      .set('Authorization', `Bearer ${token}`)
      .send({ value: 500 });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('message');
  });

  // ─── STRUCTURE ──────────────────────────────────────────────────────────────

  it('retorna 200 com array de N meses igual a duration_months', async () => {
    const res = await request(app)
      .post('/simulation')
      .set('Authorization', `Bearer ${token}`)
      .send(SIMULATION_BODY);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
  });

  it('limita a 12 meses quando duration_months > 12', async () => {
    const res = await request(app)
      .post('/simulation')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...SIMULATION_BODY, duration_months: 999 });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(12);
  });

  it('cada entrada tem as chaves e mês/ano corretos', async () => {
    const res = await request(app)
      .post('/simulation')
      .set('Authorization', `Bearer ${token}`)
      .send(SIMULATION_BODY);

    expect(res.status).toBe(200);
    const keys = ['month', 'year', 'income', 'expenses', 'card_total', 'balance', 'installment', 'balance_with_simulation'];
    res.body.data.forEach(entry => keys.forEach(k => expect(entry).toHaveProperty(k)));

    expect(res.body.data[0]).toMatchObject({ month: 4, year: 2026 });
    expect(res.body.data[1]).toMatchObject({ month: 5, year: 2026 });
    expect(res.body.data[2]).toMatchObject({ month: 6, year: 2026 });
  });

  it('avança o ano corretamente quando os meses cruzam dezembro', async () => {
    const res = await request(app)
      .post('/simulation')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...SIMULATION_BODY, start_month: 11, start_year: 2026, duration_months: 3 });

    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({ month: 11, year: 2026 });
    expect(res.body.data[1]).toMatchObject({ month: 12, year: 2026 });
    expect(res.body.data[2]).toMatchObject({ month: 1,  year: 2027 });
  });

  // ─── AGGREGATION ────────────────────────────────────────────────────────────

  it('retorna zeros quando não há dados cadastrados', async () => {
    const res = await request(app)
      .post('/simulation')
      .set('Authorization', `Bearer ${token}`)
      .send(SIMULATION_BODY);

    expect(res.status).toBe(200);
    const entry = res.body.data[0];
    expect(entry.income).toBe(0);
    expect(entry.expenses).toBe(0);
    expect(entry.card_total).toBe(0);
  });

  it('income inclui o salário líquido da salary_config', async () => {
    await pool.query(
      `INSERT INTO salary_config (user_id, gross_salary, has_inss, has_irrf, vt_percentage, health_plan, other_discounts)
       VALUES ($1, 5000, false, false, 0, 0, '[]')`,
      [userId]
    );

    const res = await request(app)
      .post('/simulation')
      .set('Authorization', `Bearer ${token}`)
      .send(SIMULATION_BODY);

    expect(res.status).toBe(200);
    expect(res.body.data[0].income).toBe(5000);

    await pool.query('DELETE FROM salary_config WHERE user_id = $1', [userId]);
  });

  it('income inclui salary_config + ganhos da tabela incomes', async () => {
    await pool.query(
      `INSERT INTO salary_config (user_id, gross_salary, has_inss, has_irrf, vt_percentage, health_plan, other_discounts)
       VALUES ($1, 5000, false, false, 0, 0, '[]')`,
      [userId]
    );
    await pool.query(
      `INSERT INTO incomes (user_id, label, value, type, start_month, start_year, duration_months)
       VALUES ($1, 'VR', 500, 'vr', 4, 2026, 999)`,
      [userId]
    );

    const res = await request(app)
      .post('/simulation')
      .set('Authorization', `Bearer ${token}`)
      .send(SIMULATION_BODY);

    expect(res.status).toBe(200);
    expect(res.body.data[0].income).toBe(5500);

    await pool.query('DELETE FROM salary_config WHERE user_id = $1', [userId]);
  });

  it('income reflete apenas os ganhos da tabela incomes quando não há salary_config', async () => {
    await pool.query(
      `INSERT INTO incomes (user_id, label, value, type, start_month, start_year, duration_months)
       VALUES ($1, 'Renda extra', 1000, 'extra', 4, 2026, 999)`,
      [userId]
    );

    const res = await request(app)
      .post('/simulation')
      .set('Authorization', `Bearer ${token}`)
      .send(SIMULATION_BODY);

    expect(res.status).toBe(200);
    expect(res.body.data[0].income).toBe(1000);
  });

  it('expenses reflete as despesas ativas no mês simulado', async () => {
    await pool.query(
      `INSERT INTO expenses (user_id, label, value, start_month, start_year, duration_months)
       VALUES ($1, 'Aluguel', 1500, 4, 2026, 999)`,
      [userId]
    );

    const res = await request(app)
      .post('/simulation')
      .set('Authorization', `Bearer ${token}`)
      .send(SIMULATION_BODY);

    expect(res.status).toBe(200);
    expect(res.body.data[0].expenses).toBe(1500);
  });

  it('card_total reflete as transações de cartão ativas no mês simulado', async () => {
    const { rows: cardRows } = await pool.query(
      `INSERT INTO credit_cards (user_id, name) VALUES ($1, 'Nubank') RETURNING *`,
      [userId]
    );
    await pool.query(
      `INSERT INTO card_transactions (credit_card_id, description, value, date, start_month, start_year, duration_months)
       VALUES ($1, 'Netflix', 45.90, '2026-04-01', 4, 2026, 1)`,
      [cardRows[0].id]
    );

    const res = await request(app)
      .post('/simulation')
      .set('Authorization', `Bearer ${token}`)
      .send(SIMULATION_BODY);

    expect(res.status).toBe(200);
    expect(parseFloat(res.body.data[0].card_total)).toBe(45.90);
  });

  it('balance_with_simulation = balance - installment', async () => {
    await pool.query(
      `INSERT INTO incomes (user_id, label, value, type, start_month, start_year, duration_months)
       VALUES ($1, 'Salário', 4000, 'salary', 4, 2026, 999)`,
      [userId]
    );
    await pool.query(
      `INSERT INTO expenses (user_id, label, value, start_month, start_year, duration_months)
       VALUES ($1, 'Aluguel', 1000, 4, 2026, 999)`,
      [userId]
    );

    const res = await request(app)
      .post('/simulation')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...SIMULATION_BODY, value: 500 });

    expect(res.status).toBe(200);
    const entry = res.body.data[0];
    expect(entry.balance).toBe(3000);
    expect(entry.installment).toBe(500);
    expect(entry.balance_with_simulation).toBe(2500);
  });

  it('não inclui dados de outro usuário na simulação', async () => {
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash) VALUES ('Outro', 'outro_sim@test.com', 'x') RETURNING *`
    );
    const otherUser = rows[0];

    await pool.query(
      `INSERT INTO incomes (user_id, label, value, type, start_month, start_year, duration_months)
       VALUES ($1, 'Salário alheio', 9999, 'salary', 4, 2026, 999)`,
      [otherUser.id]
    );
    await pool.query(
      `INSERT INTO expenses (user_id, label, value, start_month, start_year, duration_months)
       VALUES ($1, 'Despesa alheia', 9999, 4, 2026, 999)`,
      [otherUser.id]
    );
    const { rows: cardRows } = await pool.query(
      `INSERT INTO credit_cards (user_id, name) VALUES ($1, 'Cartão Alheio') RETURNING *`,
      [otherUser.id]
    );
    await pool.query(
      `INSERT INTO card_transactions (credit_card_id, description, value, date, start_month, start_year, duration_months)
       VALUES ($1, 'Transação alheia', 9999, '2026-04-01', 4, 2026, 1)`,
      [cardRows[0].id]
    );

    const res = await request(app)
      .post('/simulation')
      .set('Authorization', `Bearer ${token}`)
      .send(SIMULATION_BODY);

    expect(res.status).toBe(200);
    const entry = res.body.data[0];
    expect(entry.income).toBe(0);
    expect(entry.expenses).toBe(0);
    expect(entry.card_total).toBe(0);

    await pool.query('DELETE FROM users WHERE id = $1', [otherUser.id]);
  });
});
