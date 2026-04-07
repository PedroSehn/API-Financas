const request = require('supertest');
const app = require('../src/app');
const { TEST_USER, createTestUser, cleanupTestUsers } = require('./helpers/db');

beforeAll(createTestUser);
afterAll(cleanupTestUsers);

describe('Login — POST /auth/login', () => {
  it('retorna 200 com token JWT e dados do usuário quando as credenciais são válidas', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: TEST_USER.email, password: TEST_USER.password });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('token');
    expect(res.body.data.user).toMatchObject({
      email: TEST_USER.email,
      name: TEST_USER.name,
      is_demo: false,
    });
  });

  it('retorna 401 quando a senha está incorreta', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: TEST_USER.email, password: 'senhaerrada' });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('message');
  });

  it('retorna 401 quando o e-mail não existe no banco', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'naoexiste@test.com', password: 'test123' });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('message');
  });

  it('retorna 400 quando o campo e-mail não é enviado', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ password: TEST_USER.password });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('message');
  });

  it('retorna 400 quando o campo senha não é enviado', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: TEST_USER.email });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('message');
  });
});
