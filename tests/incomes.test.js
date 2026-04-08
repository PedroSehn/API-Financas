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
  await pool.query('DELETE FROM incomes WHERE user_id = $1', [userId]);
});

const INCOME_BODY = {
  label: 'Salário',
  emoji: '💰',
  value: 3000,
  type: 'salary',
  start_month: 1,
  start_year: 2026,
  duration_months: 999,
};

async function createIncome(body = INCOME_BODY) {
  const res = await request(app)
    .post('/incomes')
    .set('Authorization', `Bearer ${token}`)
    .send(body);
  return res.body.data;
}

// ─── GET ──────────────────────────────────────────────────────────────────────

describe('Listar ganhos por mês — GET /incomes', () => {
  it('retorna 400 quando year ou month não são enviados', async () => {
    const res = await request(app)
      .get('/incomes')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('message');
  });

  it('retorna 200 com array vazio quando não há ganhos no mês', async () => {
    const res = await request(app)
      .get('/incomes?year=2026&month=4')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('retorna o ganho quando o mês consultado está dentro da duração', async () => {
    await createIncome();

    const res = await request(app)
      .get('/incomes?year=2026&month=6')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].label).toBe('Salário');
  });

  it('não retorna o ganho quando o mês consultado é anterior ao start', async () => {
    await createIncome({ ...INCOME_BODY, start_month: 3, start_year: 2026, duration_months: 1 });

    const res = await request(app)
      .get('/incomes?year=2026&month=2')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('não retorna o ganho quando a duração já expirou', async () => {
    await createIncome({ ...INCOME_BODY, start_month: 1, start_year: 2026, duration_months: 2 });

    const res = await request(app)
      .get('/incomes?year=2026&month=3')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('não retorna ganhos de outro usuário', async () => {
    await createIncome({ ...INCOME_BODY, start_month: 1, start_year: 2026 });

    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash) VALUES ('Outro', 'outro@test.com', 'x') RETURNING *`
    );
    const otherUser = rows[0];

    await pool.query(
      `INSERT INTO incomes (user_id, label, value, type, start_month, start_year, duration_months)
       VALUES ($1, 'Ganho alheio', 1000, 'extra', 1, 2026, 999)`,
      [otherUser.id]
    );

    const res = await request(app)
      .get('/incomes?year=2026&month=1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].user_id).toBe(userId);

    await pool.query('DELETE FROM users WHERE id = $1', [otherUser.id]);
  });
});

// ─── POST ─────────────────────────────────────────────────────────────────────

describe('Criar ganho — POST /incomes', () => {
  it('retorna 400 quando campos obrigatórios estão ausentes', async () => {
    const res = await request(app)
      .post('/incomes')
      .set('Authorization', `Bearer ${token}`)
      .send({ label: 'Sem valor' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('message');
  });

  it('retorna 400 quando type é inválido', async () => {
    const res = await request(app)
      .post('/incomes')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...INCOME_BODY, type: 'invalido' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('message');
  });

  it('retorna 201 com o ganho criado ao enviar todos os campos', async () => {
    const res = await request(app)
      .post('/incomes')
      .set('Authorization', `Bearer ${token}`)
      .send(INCOME_BODY);

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      label: 'Salário',
      type: 'salary',
      user_id: userId,
    });
    expect(parseFloat(res.body.data.value)).toBe(3000);
    expect(res.body.data.id).toBeDefined();
  });

  it('cria ganho sem emoji quando o campo não é enviado', async () => {
    const { emoji, ...bodyWithoutEmoji } = INCOME_BODY;

    const res = await request(app)
      .post('/incomes')
      .set('Authorization', `Bearer ${token}`)
      .send(bodyWithoutEmoji);

    expect(res.status).toBe(201);
    expect(res.body.data.emoji).toBeNull();
  });

  it('usa duration_months = 1 como padrão quando não é enviado', async () => {
    const { duration_months, ...bodyWithoutDuration } = INCOME_BODY;

    const res = await request(app)
      .post('/incomes')
      .set('Authorization', `Bearer ${token}`)
      .send(bodyWithoutDuration);

    expect(res.status).toBe(201);
    expect(res.body.data.duration_months).toBe(1);
  });

  it.each(['salary', 'vr', 'extra'])('aceita type "%s"', async (type) => {
    const res = await request(app)
      .post('/incomes')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...INCOME_BODY, type });

    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe(type);
  });
});

// ─── PUT ──────────────────────────────────────────────────────────────────────

describe('Atualizar ganho — PUT /incomes/:id', () => {
  it('retorna 400 quando campos obrigatórios estão ausentes', async () => {
    const income = await createIncome();

    const res = await request(app)
      .put(`/incomes/${income.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ label: 'Sem valor' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('message');
  });

  it('retorna 404 quando o ganho não existe', async () => {
    const res = await request(app)
      .put('/incomes/999999')
      .set('Authorization', `Bearer ${token}`)
      .send(INCOME_BODY);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('message');
  });

  it('retorna 200 com os dados atualizados', async () => {
    const income = await createIncome();

    const res = await request(app)
      .put(`/incomes/${income.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ ...INCOME_BODY, label: 'Salário Atualizado', value: 4000 });

    expect(res.status).toBe(200);
    expect(res.body.data.label).toBe('Salário Atualizado');
    expect(parseFloat(res.body.data.value)).toBe(4000);
  });

  it('não atualiza ganho de outro usuário', async () => {
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash) VALUES ('Outro2', 'outro2@test.com', 'x') RETURNING *`
    );
    const otherUser = rows[0];
    const { rows: incomeRows } = await pool.query(
      `INSERT INTO incomes (user_id, label, value, type, start_month, start_year, duration_months)
       VALUES ($1, 'Ganho alheio', 500, 'extra', 1, 2026, 1) RETURNING *`,
      [otherUser.id]
    );

    const res = await request(app)
      .put(`/incomes/${incomeRows[0].id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(INCOME_BODY);

    expect(res.status).toBe(404);

    await pool.query('DELETE FROM users WHERE id = $1', [otherUser.id]);
  });
});

// ─── DELETE ───────────────────────────────────────────────────────────────────

describe('Remover ganho — DELETE /incomes/:id', () => {
  it('retorna 404 quando o ganho não existe', async () => {
    const res = await request(app)
      .delete('/incomes/999999')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('message');
  });

  it('retorna 200 e remove o ganho corretamente', async () => {
    const income = await createIncome();

    const res = await request(app)
      .delete(`/incomes/${income.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');

    const { rows } = await pool.query('SELECT * FROM incomes WHERE id = $1', [income.id]);
    expect(rows).toHaveLength(0);
  });

  it('não remove ganho de outro usuário', async () => {
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash) VALUES ('Outro3', 'outro3@test.com', 'x') RETURNING *`
    );
    const otherUser = rows[0];
    const { rows: incomeRows } = await pool.query(
      `INSERT INTO incomes (user_id, label, value, type, start_month, start_year, duration_months)
       VALUES ($1, 'Ganho alheio', 500, 'extra', 1, 2026, 1) RETURNING *`,
      [otherUser.id]
    );

    const res = await request(app)
      .delete(`/incomes/${incomeRows[0].id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);

    await pool.query('DELETE FROM users WHERE id = $1', [otherUser.id]);
  });
});
