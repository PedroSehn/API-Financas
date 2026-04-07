# Skill: Testing

Framework de testes do backend: **Jest + Supertest**.
Todos os testes batem no banco real — nunca mockar o banco.

---

## Setup

### Dependências
```bash
npm install --save-dev jest supertest
```

### package.json
```json
"scripts": {
  "test": "jest --runInBand --forceExit"
}
```

> `--runInBand` evita conflitos de concorrência no banco.  
> `--forceExit` fecha as conexões do `pg` ao terminar.

### jest.config.js
```js
module.exports = {
  testEnvironment: 'node',
  setupFiles: ['dotenv/config'],  // carrega .env antes de cada suite
  testMatch: ['**/tests/**/*.test.js'],
  verbose: true,
  silent: true,  // suprime console.log do app durante os testes
};
```

### Estrutura de pastas
```
tests/
├── helpers/
│   ├── db.js          ← lifecycle de usuários de teste + generateToken
│   └── factories.js   ← factories de dados por módulo
├── health.test.js
├── auth.test.js
├── middlewares.test.js
├── salary.test.js
├── expenses.test.js
├── incomes.test.js
├── credit-cards.test.js
└── simulation.test.js
```

---

## Usuário de teste

Nunca usar dados reais. Todos os testes usam usuários fixos criados e destruídos via helpers.

```js
// tests/helpers/db.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../../src/config/database');

const TEST_USER = {
  name: 'Jest Test',
  email: 'jest_test@test.com',
  password: 'test123',
  is_demo: false,
};

const TEST_DEMO_USER = {
  name: 'Jest Demo',
  email: 'jest_demo@test.com',
  password: 'demo123',
  is_demo: true,
};

async function createTestUser() {
  const hash = await bcrypt.hash(TEST_USER.password, 10);
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash, is_demo)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
     RETURNING *`,
    [TEST_USER.name, TEST_USER.email, hash, TEST_USER.is_demo]
  );
  return rows[0];
}

async function createDemoUser() {
  const hash = await bcrypt.hash(TEST_DEMO_USER.password, 10);
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash, is_demo)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
     RETURNING *`,
    [TEST_DEMO_USER.name, TEST_DEMO_USER.email, hash, TEST_DEMO_USER.is_demo]
  );
  return rows[0];
}

async function cleanupTestUsers() {
  await pool.query(
    `DELETE FROM users WHERE email IN ($1, $2)`,
    [TEST_USER.email, TEST_DEMO_USER.email]
  );
}

// Limpa apenas os dados (não o usuário) — útil no afterEach
async function cleanTestUserData(userId) {
  await pool.query(`DELETE FROM card_transactions WHERE credit_card_id IN (
    SELECT id FROM credit_cards WHERE user_id = $1
  )`, [userId]);
  await pool.query(`DELETE FROM credit_cards  WHERE user_id = $1`, [userId]);
  await pool.query(`DELETE FROM expenses       WHERE user_id = $1`, [userId]);
  await pool.query(`DELETE FROM incomes        WHERE user_id = $1`, [userId]);
  await pool.query(`DELETE FROM salary_config  WHERE user_id = $1`, [userId]);
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, is_demo: user.is_demo },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

module.exports = {
  TEST_USER, TEST_DEMO_USER,
  createTestUser, createDemoUser,
  cleanupTestUsers, cleanTestUserData,
  generateToken,
};
```

---

## Factories

Centralizam dados de teste. Evitam repetição e facilitam variações nos testes.

```js
// tests/helpers/factories.js
const expenseFactory = (overrides = {}) => ({
  label: 'Internet',
  emoji: '🌐',
  value: 119.00,
  category: 'fixo',
  start_month: 1,
  start_year: 2025,
  duration_months: 12,
  ...overrides,
});

const incomeFactory = (overrides = {}) => ({
  label: 'Salário',
  emoji: '💰',
  value: 3800.00,
  type: 'salary',
  start_month: 1,
  start_year: 2025,
  duration_months: 999,
  ...overrides,
});

const cardFactory = (overrides = {}) => ({
  name: 'Nubank',
  emoji: '💳',
  color: '#820AD1',
  ...overrides,
});

const transactionFactory = (overrides = {}) => ({
  description: 'Spotify',
  emoji: '🎵',
  value: 21.90,
  date: '2025-01-15',
  start_month: 1,
  start_year: 2025,
  duration_months: 1,
  ...overrides,
});

module.exports = { expenseFactory, incomeFactory, cardFactory, transactionFactory };
```

---

## Padrão de teste

```js
const request = require('supertest');
const pool = require('../src/config/database');
const app = require('../src/app');
const { createTestUser, cleanupTestUsers, cleanTestUserData, generateToken } = require('./helpers/db');
const { expenseFactory } = require('./helpers/factories');

let token;
let userId;

beforeAll(async () => {
  const user = await createTestUser();
  userId = user.id;
  token = generateToken(user);
});

afterAll(cleanupTestUsers);

afterEach(async () => {
  await cleanTestUserData(userId);  // isola cada teste
});

describe('Criar despesa — POST /expenses', () => {
  it('retorna 201 com o recurso criado quando os dados são válidos', async () => {
    const res = await request(app)
      .post('/expenses')
      .set('Authorization', `Bearer ${token}`)
      .send(expenseFactory());

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('id');
  });

  it('retorna 401 quando nenhum token é enviado', async () => {
    const res = await request(app)
      .post('/expenses')
      .send(expenseFactory());

    expect(res.status).toBe(401);
  });
});
```

---

## Isolamento por user_id

Todo módulo com dados por usuário deve ter um teste que garante que um usuário não acessa dados de outro.

```js
it('retorna 404 ao tentar editar recurso de outro usuário', async () => {
  const createRes = await request(app)
    .post('/expenses')
    .set('Authorization', `Bearer ${token}`)
    .send(expenseFactory());

  const id = createRes.body.data.id;

  const otherToken = generateToken({ id: 9999, name: 'Outro', email: 'outro@test.com', is_demo: false });

  const res = await request(app)
    .put(`/expenses/${id}`)
    .set('Authorization', `Bearer ${otherToken}`)
    .send(expenseFactory({ value: 999 }));

  expect(res.status).toBe(404);
});
```

---

## Cenários obrigatórios por módulo

**Todo módulo de CRUD deve cobrir:**
- criação com sucesso (201)
- campo obrigatório ausente (400)
- leitura retorna dados do usuário (200)
- edição com sucesso (200)
- edição/deleção de recurso de outro usuário retorna 404
- requisição sem token retorna 401
- usuário demo bloqueado em escrita (403)
- deleção com sucesso (204 ou 200)

**Módulos que usam filtro de mês (expenses, incomes, credit-cards) devem cobrir também:**
- item aparece no mês correto
- item fora do período não aparece na consulta
- `duration_months: 1` — aparece só no mês de início
- `duration_months: 6` — aparece nos 6 meses corretos e não nos adjacentes
- `duration_months: 999` — aparece em qualquer mês futuro consultado

---

## Regras da skill

- NUNCA mockar o banco — usar sempre o PostgreSQL real
- SEMPRE limpar dados com `cleanTestUserData` no `afterEach`
- NUNCA usar `user_id` hardcoded — sempre via `user.id` retornado pelo banco
- SEMPRE testar isolamento: outro usuário não acessa seus dados
- SEMPRE testar os três cenários de duração em módulos com `monthFilter`
- Usar factories para montar payloads; `overrides` para variações de cenário
- Nomes dos testes descrevem o comportamento esperado, não a implementação
