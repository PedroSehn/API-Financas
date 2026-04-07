const request = require('supertest');
const app = require('../src/app');
const { createTestUser, createDemoUser, cleanupTestUsers, generateToken } = require('./helpers/db');

let demoToken;

beforeAll(async () => {
  await createTestUser();
  const demoUser = await createDemoUser();
  demoToken = generateToken(demoUser);
});

afterAll(cleanupTestUsers);

describe('Middleware de autenticação (JWT)', () => {
  it('retorna 401 quando nenhum header Authorization é enviado', async () => {
    const res = await request(app).get('/salary');
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Token não fornecido');
  });

  it('retorna 401 quando o token JWT é inválido ou malformado', async () => {
    const res = await request(app)
      .get('/salary')
      .set('Authorization', 'Bearer tokeninvalido');

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Token inválido');
  });
});

describe('Middleware de usuário demo', () => {
  it('retorna 403 quando o usuário demo tenta criar um recurso (POST)', async () => {
    const res = await request(app)
      .post('/salary')
      .set('Authorization', `Bearer ${demoToken}`)
      .send({ gross_salary: 3000 });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Usuário demo não pode realizar esta ação');
  });

  it('permite que o usuário demo leia dados (GET), passando pelos middlewares sem bloqueio', async () => {
    const res = await request(app)
      .get('/salary')
      .set('Authorization', `Bearer ${demoToken}`);

    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});
