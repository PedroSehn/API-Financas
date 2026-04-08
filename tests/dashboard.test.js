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
    pool.query('DELETE FROM salary_config WHERE user_id = $1', [userId]),
    pool.query('DELETE FROM incomes      WHERE user_id = $1', [userId]),
    pool.query('DELETE FROM expenses     WHERE user_id = $1', [userId]),
    pool.query('DELETE FROM credit_cards WHERE user_id = $1', [userId]),
  ]);
});

// ─── VALIDATION ───────────────────────────────────────────────────────────────

describe('Dashboard — GET /dashboard', () => {
  it('retorna 400 quando year ou month não são enviados', async () => {
    const res = await request(app)
      .get('/dashboard')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('message');
  });

  // ─── STRUCTURE ──────────────────────────────────────────────────────────────

  it('retorna 200 com todas as chaves esperadas', async () => {
    const res = await request(app)
      .get('/dashboard?year=2026&month=4')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d).toHaveProperty('month', 4);
    expect(d).toHaveProperty('year', 2026);
    expect(d).toHaveProperty('salary');
    expect(d).toHaveProperty('incomes');
    expect(d).toHaveProperty('expenses');
    expect(d).toHaveProperty('credit_cards');
    expect(d).toHaveProperty('summary');
    expect(d.summary).toHaveProperty('total_income');
    expect(d.summary).toHaveProperty('total_expenses');
    expect(d.summary).toHaveProperty('total_credit_cards');
    expect(d.summary).toHaveProperty('balance');
  });

  it('salary é null quando não há salary_config', async () => {
    const res = await request(app)
      .get('/dashboard?year=2026&month=4')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.salary).toBeNull();
  });

  // ─── SALARY ─────────────────────────────────────────────────────────────────

  it('salary retorna gross, net e total_discounts quando configurado', async () => {
    await pool.query(
      `INSERT INTO salary_config (user_id, gross_salary, has_inss, has_irrf, vt_percentage, health_plan, other_discounts)
       VALUES ($1, 5000, false, false, 0, 0, '[]')`,
      [userId]
    );

    const res = await request(app)
      .get('/dashboard?year=2026&month=4')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.salary).toMatchObject({ gross: 5000, net: 5000, total_discounts: 0 });
  });

  // ─── SUMMARY ────────────────────────────────────────────────────────────────

  it('summary.total_income inclui salário líquido + incomes do mês', async () => {
    await pool.query(
      `INSERT INTO salary_config (user_id, gross_salary, has_inss, has_irrf, vt_percentage, health_plan, other_discounts)
       VALUES ($1, 4000, false, false, 0, 0, '[]')`,
      [userId]
    );
    await pool.query(
      `INSERT INTO incomes (user_id, label, value, type, start_month, start_year, duration_months)
       VALUES ($1, 'VR', 500, 'vr', 4, 2026, 999)`,
      [userId]
    );

    const res = await request(app)
      .get('/dashboard?year=2026&month=4')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.summary.total_income).toBe(4500);
  });

  it('summary.total_expenses reflete as despesas ativas no mês', async () => {
    await pool.query(
      `INSERT INTO expenses (user_id, label, value, start_month, start_year, duration_months)
       VALUES ($1, 'Aluguel', 1500, 4, 2026, 999)`,
      [userId]
    );

    const res = await request(app)
      .get('/dashboard?year=2026&month=4')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.summary.total_expenses).toBe(1500);
  });

  it('summary.total_credit_cards reflete o total das transações de cartão no mês', async () => {
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
      .get('/dashboard?year=2026&month=4')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(parseFloat(res.body.data.summary.total_credit_cards)).toBe(45.90);
  });

  it('summary.balance = total_income - total_expenses - total_credit_cards', async () => {
    await pool.query(
      `INSERT INTO salary_config (user_id, gross_salary, has_inss, has_irrf, vt_percentage, health_plan, other_discounts)
       VALUES ($1, 4000, false, false, 0, 0, '[]')`,
      [userId]
    );
    await pool.query(
      `INSERT INTO expenses (user_id, label, value, start_month, start_year, duration_months)
       VALUES ($1, 'Aluguel', 1000, 4, 2026, 999)`,
      [userId]
    );
    const { rows: cardRows } = await pool.query(
      `INSERT INTO credit_cards (user_id, name) VALUES ($1, 'Nubank') RETURNING *`,
      [userId]
    );
    await pool.query(
      `INSERT INTO card_transactions (credit_card_id, description, value, date, start_month, start_year, duration_months)
       VALUES ($1, 'Netflix', 500, '2026-04-01', 4, 2026, 1)`,
      [cardRows[0].id]
    );

    const res = await request(app)
      .get('/dashboard?year=2026&month=4')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const s = res.body.data.summary;
    expect(s.total_income).toBe(4000);
    expect(s.total_expenses).toBe(1000);
    expect(s.total_credit_cards).toBe(500);
    expect(s.balance).toBe(2500);
  });

  // ─── CREDIT CARDS ───────────────────────────────────────────────────────────

  it('credit_cards traz as transações do mês aninhadas com month_total', async () => {
    const { rows: cardRows } = await pool.query(
      `INSERT INTO credit_cards (user_id, name, emoji, color) VALUES ($1, 'Nubank', '💳', '#8A05BE') RETURNING *`,
      [userId]
    );
    await pool.query(
      `INSERT INTO card_transactions (credit_card_id, description, value, date, start_month, start_year, duration_months)
       VALUES ($1, 'Netflix', 45.90, '2026-04-01', 4, 2026, 1),
              ($1, 'Spotify', 21.90, '2026-04-01', 4, 2026, 1)`,
      [cardRows[0].id]
    );

    const res = await request(app)
      .get('/dashboard?year=2026&month=4')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const card = res.body.data.credit_cards[0];
    expect(card.name).toBe('Nubank');
    expect(card.transactions).toHaveLength(2);
    expect(parseFloat(card.month_total)).toBe(67.80);
  });

  // ─── ISOLATION ──────────────────────────────────────────────────────────────

  it('não inclui dados de outro usuário', async () => {
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash) VALUES ('Outro', 'outro_dash@test.com', 'x') RETURNING *`
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

    const res = await request(app)
      .get('/dashboard?year=2026&month=4')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.incomes).toHaveLength(0);
    expect(res.body.data.expenses).toHaveLength(0);
    expect(res.body.data.summary.total_income).toBe(0);
    expect(res.body.data.summary.total_expenses).toBe(0);

    await pool.query('DELETE FROM users WHERE id = $1', [otherUser.id]);
  });
});
