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
  await pool.query('DELETE FROM salary_config WHERE user_id = $1', [userId]);
});

const SALARY_BODY = {
  gross_salary: 5000,
  has_inss: true,
  has_irrf: true,
  vt_percentage: 6,
  health_plan: 150,
  other_discounts: [],
};

describe('Buscar configuração de salário — GET /salary', () => {
  it('retorna 404 quando o usuário ainda não possui configuração de salário', async () => {
    const res = await request(app)
      .get('/salary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('message');
  });

  it('retorna 200 com a configuração e os campos calculados (INSS, IRRF, líquido) após criação', async () => {
    await request(app)
      .post('/salary')
      .set('Authorization', `Bearer ${token}`)
      .send(SALARY_BODY);

    const res = await request(app)
      .get('/salary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('gross_salary');
    expect(res.body.data).toHaveProperty('calculated');
    expect(res.body.data.calculated).toHaveProperty('net');
    expect(res.body.data.calculated).toHaveProperty('inss');
    expect(res.body.data.calculated).toHaveProperty('irrf');
  });
});

describe('Criar configuração de salário — POST /salary', () => {
  it('retorna 400 quando o salário bruto não é enviado', async () => {
    const res = await request(app)
      .post('/salary')
      .set('Authorization', `Bearer ${token}`)
      .send({ has_inss: true });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('message');
  });

  it('retorna 201 com a configuração criada e os descontos calculados corretamente', async () => {
    const res = await request(app)
      .post('/salary')
      .set('Authorization', `Bearer ${token}`)
      .send(SALARY_BODY);

    expect(res.status).toBe(201);
    expect(parseFloat(res.body.data.gross_salary)).toBe(5000);
    expect(res.body.data.calculated).toMatchObject({
      inss: expect.any(Number),
      irrf: expect.any(Number),
      vt: expect.any(Number),
      health_plan: 150,
      net: expect.any(Number),
    });
    expect(res.body.data.calculated.net).toBeLessThan(5000);
  });
});

describe('Atualizar configuração de salário — PUT /salary', () => {
  it('retorna 404 quando não existe configuração de salário para atualizar', async () => {
    const res = await request(app)
      .put('/salary')
      .set('Authorization', `Bearer ${token}`)
      .send(SALARY_BODY);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('message');
  });

  it('retorna 400 quando o salário bruto não é enviado na atualização', async () => {
    await request(app)
      .post('/salary')
      .set('Authorization', `Bearer ${token}`)
      .send(SALARY_BODY);

    const res = await request(app)
      .put('/salary')
      .set('Authorization', `Bearer ${token}`)
      .send({ has_inss: false });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('message');
  });

  it('retorna 200 com o salário atualizado e o líquido recalculado', async () => {
    await request(app)
      .post('/salary')
      .set('Authorization', `Bearer ${token}`)
      .send(SALARY_BODY);

    const res = await request(app)
      .put('/salary')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...SALARY_BODY, gross_salary: 8000 });

    expect(res.status).toBe(200);
    expect(parseFloat(res.body.data.gross_salary)).toBe(8000);
    expect(res.body.data.calculated.net).toBeLessThan(8000);
  });
});
