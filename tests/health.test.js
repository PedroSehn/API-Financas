const request = require('supertest');
const app = require('../src/app');

describe('Health Check — GET /health', () => {
  it('retorna 200 com texto "OK" quando o banco está acessível', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.text).toBe('OK');
  });
});
