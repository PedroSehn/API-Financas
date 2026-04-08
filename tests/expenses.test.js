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
  await pool.query('DELETE FROM expenses WHERE user_id = $1', [userId]);
});

const EXPENSE_BODY = {
  label: 'Aluguel',
  emoji: '🏠',
  value: 1500,
  category: 'moradia',
  start_month: 1,
  start_year: 2026,
  duration_months: 999,
};

async function createExpense(body = EXPENSE_BODY) {
  const res = await request(app)
    .post('/expenses')
    .set('Authorization', `Bearer ${token}`)
    .send(body);
  return res.body.data;
}

// ─── GET ──────────────────────────────────────────────────────────────────────

describe('Listar despesas por mês — GET /expenses', () => {
  it('retorna 400 quando year ou month não são enviados', async () => {
    const res = await request(app)
      .get('/expenses')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('message');
  });

  it('retorna 200 com array vazio quando não há despesas no mês', async () => {
    const res = await request(app)
      .get('/expenses?year=2026&month=4')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('retorna a despesa quando o mês consultado está dentro da duração', async () => {
    await createExpense();

    const res = await request(app)
      .get('/expenses?year=2026&month=6')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].label).toBe('Aluguel');
  });

  it('não retorna a despesa quando o mês consultado é anterior ao start', async () => {
    await createExpense({ ...EXPENSE_BODY, start_month: 3, start_year: 2026, duration_months: 1 });

    const res = await request(app)
      .get('/expenses?year=2026&month=2')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('não retorna a despesa quando a duração já expirou', async () => {
    await createExpense({ ...EXPENSE_BODY, start_month: 1, start_year: 2026, duration_months: 2 });

    const res = await request(app)
      .get('/expenses?year=2026&month=3')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('não retorna despesas de outro usuário', async () => {
    await createExpense({ ...EXPENSE_BODY, start_month: 1, start_year: 2026 });

    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash) VALUES ('Outro', 'outro_exp@test.com', 'x') RETURNING *`
    );
    const otherUser = rows[0];

    await pool.query(
      `INSERT INTO expenses (user_id, label, value, start_month, start_year, duration_months)
       VALUES ($1, 'Despesa alheia', 500, 1, 2026, 999)`,
      [otherUser.id]
    );

    const res = await request(app)
      .get('/expenses?year=2026&month=1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].user_id).toBe(userId);

    await pool.query('DELETE FROM users WHERE id = $1', [otherUser.id]);
  });
});

// ─── POST ─────────────────────────────────────────────────────────────────────

describe('Criar despesa — POST /expenses', () => {
  it('retorna 400 quando campos obrigatórios estão ausentes', async () => {
    const res = await request(app)
      .post('/expenses')
      .set('Authorization', `Bearer ${token}`)
      .send({ label: 'Sem valor' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('message');
  });

  it('retorna 201 com a despesa criada ao enviar todos os campos', async () => {
    const res = await request(app)
      .post('/expenses')
      .set('Authorization', `Bearer ${token}`)
      .send(EXPENSE_BODY);

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      label: 'Aluguel',
      category: 'moradia',
      user_id: userId,
    });
    expect(parseFloat(res.body.data.value)).toBe(1500);
    expect(res.body.data.id).toBeDefined();
  });

  it('cria despesa sem emoji quando o campo não é enviado', async () => {
    const { emoji, ...bodyWithoutEmoji } = EXPENSE_BODY;

    const res = await request(app)
      .post('/expenses')
      .set('Authorization', `Bearer ${token}`)
      .send(bodyWithoutEmoji);

    expect(res.status).toBe(201);
    expect(res.body.data.emoji).toBeNull();
  });

  it('cria despesa sem category quando o campo não é enviado', async () => {
    const { category, ...bodyWithoutCategory } = EXPENSE_BODY;

    const res = await request(app)
      .post('/expenses')
      .set('Authorization', `Bearer ${token}`)
      .send(bodyWithoutCategory);

    expect(res.status).toBe(201);
    expect(res.body.data.category).toBeNull();
  });

  it('usa duration_months = 1 como padrão quando não é enviado', async () => {
    const { duration_months, ...bodyWithoutDuration } = EXPENSE_BODY;

    const res = await request(app)
      .post('/expenses')
      .set('Authorization', `Bearer ${token}`)
      .send(bodyWithoutDuration);

    expect(res.status).toBe(201);
    expect(res.body.data.duration_months).toBe(1);
  });
});

// ─── PUT ──────────────────────────────────────────────────────────────────────

describe('Atualizar despesa — PUT /expenses/:id', () => {
  it('retorna 400 quando campos obrigatórios estão ausentes', async () => {
    const expense = await createExpense();

    const res = await request(app)
      .put(`/expenses/${expense.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ label: 'Sem valor' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('message');
  });

  it('retorna 404 quando a despesa não existe', async () => {
    const res = await request(app)
      .put('/expenses/999999')
      .set('Authorization', `Bearer ${token}`)
      .send(EXPENSE_BODY);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('message');
  });

  it('retorna 200 com os dados atualizados', async () => {
    const expense = await createExpense();

    const res = await request(app)
      .put(`/expenses/${expense.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ ...EXPENSE_BODY, label: 'Aluguel Atualizado', value: 1800 });

    expect(res.status).toBe(200);
    expect(res.body.data.label).toBe('Aluguel Atualizado');
    expect(parseFloat(res.body.data.value)).toBe(1800);
  });

  it('não atualiza despesa de outro usuário', async () => {
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash) VALUES ('Outro2', 'outro2_exp@test.com', 'x') RETURNING *`
    );
    const otherUser = rows[0];
    const { rows: expenseRows } = await pool.query(
      `INSERT INTO expenses (user_id, label, value, start_month, start_year, duration_months)
       VALUES ($1, 'Despesa alheia', 500, 1, 2026, 1) RETURNING *`,
      [otherUser.id]
    );

    const res = await request(app)
      .put(`/expenses/${expenseRows[0].id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(EXPENSE_BODY);

    expect(res.status).toBe(404);

    await pool.query('DELETE FROM users WHERE id = $1', [otherUser.id]);
  });
});

// ─── DELETE ───────────────────────────────────────────────────────────────────

describe('Remover despesa — DELETE /expenses/:id', () => {
  it('retorna 404 quando a despesa não existe', async () => {
    const res = await request(app)
      .delete('/expenses/999999')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('message');
  });

  it('retorna 200 e remove a despesa corretamente', async () => {
    const expense = await createExpense();

    const res = await request(app)
      .delete(`/expenses/${expense.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');

    const { rows } = await pool.query('SELECT * FROM expenses WHERE id = $1', [expense.id]);
    expect(rows).toHaveLength(0);
  });

  it('não remove despesa de outro usuário', async () => {
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash) VALUES ('Outro3', 'outro3_exp@test.com', 'x') RETURNING *`
    );
    const otherUser = rows[0];
    const { rows: expenseRows } = await pool.query(
      `INSERT INTO expenses (user_id, label, value, start_month, start_year, duration_months)
       VALUES ($1, 'Despesa alheia', 500, 1, 2026, 1) RETURNING *`,
      [otherUser.id]
    );

    const res = await request(app)
      .delete(`/expenses/${expenseRows[0].id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);

    await pool.query('DELETE FROM users WHERE id = $1', [otherUser.id]);
  });
});
