# Skill: Testing

Framework de testes do backend: **Mocha + Sinon + Chai**.
Dois tipos de teste: **unitário** (service isolado, banco mockado) e **integração** (banco real, usuário de teste isolado).

---

## Setup

### Dependências
```bash
npm install --save-dev mocha sinon chai sinon-chai
```

### package.json
```json
"scripts": {
  "test": "mocha 'tests/**/*.test.js' --timeout 10000 --exit",
  "test:unit": "mocha 'tests/unit/**/*.test.js' --timeout 5000 --exit",
  "test:integration": "mocha 'tests/integration/**/*.test.js' --timeout 10000 --exit"
}
```

### Estrutura de pastas
```
tests/
├── helpers/
│   ├── setup.js          ← configuração global (chai, sinon-chai)
│   ├── db.js             ← helpers de banco para integração
│   └── factories.js      ← factories de dados de teste
├── unit/
│   ├── expenses.test.js
│   ├── incomes.test.js
│   ├── credit-cards.test.js
│   ├── salary.test.js
│   └── simulation.test.js
└── integration/
    ├── auth.test.js
    ├── expenses.test.js
    ├── incomes.test.js
    ├── credit-cards.test.js
    └── simulation.test.js
```

### `.mocharc.js`
```js
module.exports = {
  require: ['tests/helpers/setup.js'],
  timeout: 10000,
  exit: true,
};
```

---

## Usuário de teste

Nunca usar dados reais. Todos os testes usam um usuário fixo de teste na mesma tabela `users`.

```js
// tests/helpers/db.js
const pool = require('../../src/config/database');

const TEST_USER = {
  email: 'test@financa.app',
  name: 'Usuário de Teste',
  password_hash: '$2a$10$hash_fixo_do_bcrypt', // bcrypt de 'test123'
  is_demo: false,
};

const TEST_DEMO_USER = {
  email: 'testdemo@financa.app',
  name: 'Demo Teste',
  password_hash: '$2a$10$hash_fixo_do_bcrypt',
  is_demo: true,
};

// Retorna ou cria o usuário de teste
const getTestUser = async () => {
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash, is_demo)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
     RETURNING *`,
    [TEST_USER.name, TEST_USER.email, TEST_USER.password_hash, TEST_USER.is_demo]
  );
  return rows[0];
};

const getTestDemoUser = async () => {
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash, is_demo)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
     RETURNING *`,
    [TEST_DEMO_USER.name, TEST_DEMO_USER.email, TEST_DEMO_USER.password_hash, TEST_DEMO_USER.is_demo]
  );
  return rows[0];
};

// Limpa todos os dados do usuário de teste (roda antes de cada teste de integração)
const cleanTestUserData = async (userId) => {
  await pool.query(`DELETE FROM card_transactions WHERE credit_card_id IN (
    SELECT id FROM credit_cards WHERE user_id = $1
  )`, [userId]);
  await pool.query(`DELETE FROM credit_cards WHERE user_id = $1`, [userId]);
  await pool.query(`DELETE FROM expenses WHERE user_id = $1`, [userId]);
  await pool.query(`DELETE FROM incomes WHERE user_id = $1`, [userId]);
  await pool.query(`DELETE FROM salary_config WHERE user_id = $1`, [userId]);
};

module.exports = { getTestUser, getTestDemoUser, cleanTestUserData };
```

---

## Setup global

```js
// tests/helpers/setup.js
const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');

chai.use(sinonChai);
global.expect = chai.expect;
global.sinon = sinon;

// Restaura todos os stubs/spies após cada teste
afterEach(() => {
  sinon.restore();
});
```

---

## Factories

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

## Testes unitários

Mock obrigatório do pool de banco. Nunca bater no banco real em testes unitários.

### Padrão de teste unitário

```js
// tests/unit/expenses.test.js
const sinon = require('sinon');
const { expect } = require('chai');
const pool = require('../../src/config/database');
const expensesService = require('../../src/modules/expenses/expenses.service');
const { expenseFactory } = require('../helpers/factories');

describe('ExpensesService', () => {
  let queryStub;

  beforeEach(() => {
    queryStub = sinon.stub(pool, 'query');
  });

  // getByMonth
  describe('getByMonth', () => {
    it('deve retornar expenses do mês correto', async () => {
      const fakeExpenses = [expenseFactory({ id: 1, user_id: 1 })];
      queryStub.resolves({ rows: fakeExpenses });

      const result = await expensesService.getByMonth(1, 2025, 3);

      expect(queryStub).to.have.been.calledOnce;
      expect(result).to.deep.equal(fakeExpenses);
    });

    it('deve retornar array vazio quando não há expenses no mês', async () => {
      queryStub.resolves({ rows: [] });

      const result = await expensesService.getByMonth(1, 2025, 3);

      expect(result).to.be.an('array').that.is.empty;
    });
  });

  // create
  describe('create', () => {
    it('deve criar uma expense e retornar o registro criado', async () => {
      const data = expenseFactory();
      const created = { id: 1, user_id: 1, ...data };
      queryStub.resolves({ rows: [created] });

      const result = await expensesService.create(1, data);

      expect(queryStub).to.have.been.calledOnce;
      expect(result).to.deep.equal(created);
    });

    it('deve lançar erro se a query falhar', async () => {
      queryStub.rejects(new Error('DB error'));

      await expect(expensesService.create(1, expenseFactory()))
        .to.be.rejectedWith('DB error');
    });
  });

  // update
  describe('update', () => {
    it('deve retornar null se expense não pertencer ao usuário', async () => {
      queryStub.resolves({ rows: [] });

      const result = await expensesService.update(1, 99, { value: 200 });

      expect(result).to.be.null;
    });
  });

  // delete
  describe('delete', () => {
    it('deve retornar true ao deletar com sucesso', async () => {
      queryStub.resolves({ rowCount: 1 });

      const result = await expensesService.delete(1, 1);

      expect(result).to.be.true;
    });

    it('deve retornar false se expense não existir ou não pertencer ao usuário', async () => {
      queryStub.resolves({ rowCount: 0 });

      const result = await expensesService.delete(1, 99);

      expect(result).to.be.false;
    });
  });
});
```

---

## Testes de integração

Batem no banco real. Usam o usuário de teste isolado. Sempre limpar dados antes de cada teste.

### Padrão de teste de integração

```js
// tests/integration/expenses.test.js
const { expect } = require('chai');
const request = require('supertest');
const app = require('../../src/app');
const { getTestUser, cleanTestUserData } = require('../helpers/db');
const { expenseFactory } = require('../helpers/factories');
const jwt = require('jsonwebtoken');

describe('[Integration] Expenses', () => {
  let testUser;
  let token;

  // Roda uma vez antes de todos os testes do bloco
  before(async () => {
    testUser = await getTestUser();
    token = jwt.sign(
      { id: testUser.id, email: testUser.email, is_demo: testUser.is_demo },
      process.env.JWT_SECRET
    );
  });

  // Limpa os dados do usuário de teste antes de cada teste
  beforeEach(async () => {
    await cleanTestUserData(testUser.id);
  });

  describe('POST /expenses', () => {
    it('deve criar uma expense com sucesso', async () => {
      const data = expenseFactory();

      const res = await request(app)
        .post('/expenses')
        .set('Authorization', `Bearer ${token}`)
        .send(data);

      expect(res.status).to.equal(201);
      expect(res.body.data).to.include({ label: data.label, value: data.value });
    });

    it('deve retornar 401 sem token', async () => {
      const res = await request(app)
        .post('/expenses')
        .send(expenseFactory());

      expect(res.status).to.equal(401);
    });
  });

  describe('GET /expenses?year=2025&month=1', () => {
    it('deve retornar expenses ativas no mês consultado', async () => {
      // Cria uma expense que cobre janeiro de 2025
      await request(app)
        .post('/expenses')
        .set('Authorization', `Bearer ${token}`)
        .send(expenseFactory({ start_month: 1, start_year: 2025, duration_months: 6 }));

      const res = await request(app)
        .get('/expenses?year=2025&month=1')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).to.equal(200);
      expect(res.body.data).to.have.length(1);
    });

    it('não deve retornar expenses fora do período', async () => {
      // Cria expense que começa em março — não deve aparecer em janeiro
      await request(app)
        .post('/expenses')
        .set('Authorization', `Bearer ${token}`)
        .send(expenseFactory({ start_month: 3, start_year: 2025, duration_months: 3 }));

      const res = await request(app)
        .get('/expenses?year=2025&month=1')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).to.equal(200);
      expect(res.body.data).to.have.length(0);
    });
  });

  describe('DELETE /expenses/:id', () => {
    it('não deve deletar expense de outro usuário', async () => {
      // Cria expense com usuário de teste
      const createRes = await request(app)
        .post('/expenses')
        .set('Authorization', `Bearer ${token}`)
        .send(expenseFactory());

      const expenseId = createRes.body.data.id;

      // Tenta deletar com outro token (simula usuário diferente)
      const otherToken = jwt.sign(
        { id: 9999, email: 'outro@test.com', is_demo: false },
        process.env.JWT_SECRET
      );

      const res = await request(app)
        .delete(`/expenses/${expenseId}`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).to.equal(404);
    });
  });
});
```

---

## Testes do middleware demo

```js
// tests/integration/auth.test.js
describe('[Integration] Demo middleware', () => {
  let demoToken;

  before(async () => {
    const demoUser = await getTestDemoUser();
    demoToken = jwt.sign(
      { id: demoUser.id, email: demoUser.email, is_demo: true },
      process.env.JWT_SECRET
    );
  });

  it('deve bloquear POST para usuário demo', async () => {
    const res = await request(app)
      .post('/expenses')
      .set('Authorization', `Bearer ${demoToken}`)
      .send(expenseFactory());

    expect(res.status).to.equal(403);
    expect(res.body.message).to.equal('Ação não permitida no modo demo.');
  });

  it('deve permitir GET para usuário demo', async () => {
    const res = await request(app)
      .get('/expenses?year=2025&month=1')
      .set('Authorization', `Bearer ${demoToken}`);

    expect(res.status).to.equal(200);
  });
});
```

---

## Cenários obrigatórios por módulo

Todo service deve cobrir no mínimo:

**Testes unitários:**
- retorno correto com dados válidos
- retorno vazio quando não há registros
- erro de banco propagado corretamente
- isolamento por user_id (não retornar dados de outro usuário)

**Testes de integração:**
- criação com sucesso (201)
- leitura com filtro de mês correto
- item fora do período não aparece na consulta
- deleção/edição de item de outro usuário retorna 404
- requisição sem token retorna 401
- usuário demo bloqueado em escrita (403)
- usuário demo liberado em leitura (200)

**Testes da lógica de duração (obrigatório em expenses e incomes):**
- `duration_months: 1` aparece só no mês de início
- `duration_months: 6` aparece nos 6 meses corretos e não nos adjacentes
- `duration_months: 999` aparece em qualquer mês futuro consultado

---

## Regras da skill

- NUNCA mockar o banco em testes de integração
- SEMPRE limpar dados com `cleanTestUserData` no `beforeEach` de integração
- NUNCA usar `user_id` hardcoded nos testes — sempre via `testUser.id`
- SEMPRE testar o cenário de isolamento (outro usuário não acessa seus dados)
- SEMPRE testar os três cenários de duração em qualquer módulo que use `monthFilter`
- Testes unitários ficam em `tests/unit/`, integração em `tests/integration/`
- Adicionar `supertest` para testes de integração: `npm install --save-dev supertest`
