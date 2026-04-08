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
  await pool.query('DELETE FROM credit_cards WHERE user_id = $1', [userId]);
});

const CARD_BODY = {
  name: 'Nubank',
  emoji: '💳',
  color: '#8A05BE',
};

async function createCard(body = CARD_BODY) {
  const res = await request(app)
    .post('/credit-cards')
    .set('Authorization', `Bearer ${token}`)
    .send(body);
  return res.body.data;
}

// ─── GET CARDS ────────────────────────────────────────────────────────────────

describe('Listar cartões — GET /credit-cards', () => {
  it('retorna 200 com array vazio quando não há cartões', async () => {
    const res = await request(app)
      .get('/credit-cards')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('retorna os cartões do usuário autenticado', async () => {
    await createCard();

    const res = await request(app)
      .get('/credit-cards')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Nubank');
  });

  it('não retorna cartões de outro usuário', async () => {
    await createCard();

    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash) VALUES ('Outro', 'outro_cc@test.com', 'x') RETURNING *`
    );
    const otherUser = rows[0];

    await pool.query(
      `INSERT INTO credit_cards (user_id, name) VALUES ($1, 'Cartão Alheio')`,
      [otherUser.id]
    );

    const res = await request(app)
      .get('/credit-cards')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].user_id).toBe(userId);

    await pool.query('DELETE FROM users WHERE id = $1', [otherUser.id]);
  });
});

// ─── POST CARDS ───────────────────────────────────────────────────────────────

describe('Criar cartão — POST /credit-cards', () => {
  it('retorna 400 quando name não é enviado', async () => {
    const res = await request(app)
      .post('/credit-cards')
      .set('Authorization', `Bearer ${token}`)
      .send({ emoji: '💳' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('message');
  });

  it('retorna 201 com o cartão criado', async () => {
    const res = await request(app)
      .post('/credit-cards')
      .set('Authorization', `Bearer ${token}`)
      .send(CARD_BODY);

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ name: 'Nubank', emoji: '💳', color: '#8A05BE', user_id: userId });
    expect(res.body.data.id).toBeDefined();
  });

  it('cria cartão sem emoji e color quando não são enviados', async () => {
    const res = await request(app)
      .post('/credit-cards')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Inter' });

    expect(res.status).toBe(201);
    expect(res.body.data.emoji).toBeNull();
    expect(res.body.data.color).toBeNull();
  });
});

// ─── PUT CARDS ────────────────────────────────────────────────────────────────

describe('Atualizar cartão — PUT /credit-cards/:id', () => {
  it('retorna 400 quando name não é enviado', async () => {
    const card = await createCard();

    const res = await request(app)
      .put(`/credit-cards/${card.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ emoji: '💳' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('message');
  });

  it('retorna 404 quando o cartão não existe', async () => {
    const res = await request(app)
      .put('/credit-cards/999999')
      .set('Authorization', `Bearer ${token}`)
      .send(CARD_BODY);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('message');
  });

  it('retorna 200 com os dados atualizados', async () => {
    const card = await createCard();

    const res = await request(app)
      .put(`/credit-cards/${card.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ ...CARD_BODY, name: 'Inter', color: '#FF6600' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Inter');
    expect(res.body.data.color).toBe('#FF6600');
  });

  it('não atualiza cartão de outro usuário', async () => {
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash) VALUES ('Outro2', 'outro2_cc@test.com', 'x') RETURNING *`
    );
    const otherUser = rows[0];
    const { rows: cardRows } = await pool.query(
      `INSERT INTO credit_cards (user_id, name) VALUES ($1, 'Cartão Alheio') RETURNING *`,
      [otherUser.id]
    );

    const res = await request(app)
      .put(`/credit-cards/${cardRows[0].id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(CARD_BODY);

    expect(res.status).toBe(404);

    await pool.query('DELETE FROM users WHERE id = $1', [otherUser.id]);
  });
});

// ─── DELETE CARDS ─────────────────────────────────────────────────────────────

describe('Remover cartão — DELETE /credit-cards/:id', () => {
  it('retorna 404 quando o cartão não existe', async () => {
    const res = await request(app)
      .delete('/credit-cards/999999')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('message');
  });

  it('retorna 200 e remove o cartão corretamente', async () => {
    const card = await createCard();

    const res = await request(app)
      .delete(`/credit-cards/${card.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');

    const { rows } = await pool.query('SELECT * FROM credit_cards WHERE id = $1', [card.id]);
    expect(rows).toHaveLength(0);
  });

  it('não remove cartão de outro usuário', async () => {
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash) VALUES ('Outro3', 'outro3_cc@test.com', 'x') RETURNING *`
    );
    const otherUser = rows[0];
    const { rows: cardRows } = await pool.query(
      `INSERT INTO credit_cards (user_id, name) VALUES ($1, 'Cartão Alheio') RETURNING *`,
      [otherUser.id]
    );

    const res = await request(app)
      .delete(`/credit-cards/${cardRows[0].id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);

    await pool.query('DELETE FROM users WHERE id = $1', [otherUser.id]);
  });

  it('remove as transações do cartão em cascata', async () => {
    const card = await createCard();
    const { rows: txRows } = await pool.query(
      `INSERT INTO card_transactions (credit_card_id, description, value, date, start_month, start_year, duration_months)
       VALUES ($1, 'Netflix', 45.90, '2026-04-01', 4, 2026, 1) RETURNING *`,
      [card.id]
    );

    await request(app)
      .delete(`/credit-cards/${card.id}`)
      .set('Authorization', `Bearer ${token}`);

    const { rows } = await pool.query('SELECT * FROM card_transactions WHERE id = $1', [txRows[0].id]);
    expect(rows).toHaveLength(0);
  });
});

// ─── TRANSACTIONS ─────────────────────────────────────────────────────────────

describe('Transações do cartão', () => {
  let cardId;

  beforeEach(async () => {
    const card = await createCard();
    cardId = card.id;
  });

  const TRANSACTION_BODY = {
    description: 'Netflix',
    emoji: '📺',
    value: 45.90,
    date: '2026-04-01',
    start_month: 4,
    start_year: 2026,
    duration_months: 1,
  };

  async function createTransaction(body = TRANSACTION_BODY) {
    const res = await request(app)
      .post(`/credit-cards/${cardId}/transactions`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);
    return res.body.data;
  }

  // ─── GET TRANSACTIONS ──────────────────────────────────────────────────────

  describe('Listar transações por mês — GET /credit-cards/:cardId/transactions', () => {
    it('retorna 400 quando year ou month não são enviados', async () => {
      const res = await request(app)
        .get(`/credit-cards/${cardId}/transactions`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message');
    });

    it('retorna 200 com array vazio quando não há transações no mês', async () => {
      const res = await request(app)
        .get(`/credit-cards/${cardId}/transactions?year=2026&month=4`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('retorna a transação quando o mês consultado está dentro da duração', async () => {
      await createTransaction({ ...TRANSACTION_BODY, start_month: 4, start_year: 2026, duration_months: 3 });

      const res = await request(app)
        .get(`/credit-cards/${cardId}/transactions?year=2026&month=6`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].description).toBe('Netflix');
    });

    it('não retorna a transação quando o mês consultado é anterior ao start', async () => {
      await createTransaction({ ...TRANSACTION_BODY, start_month: 4, start_year: 2026, duration_months: 1 });

      const res = await request(app)
        .get(`/credit-cards/${cardId}/transactions?year=2026&month=3`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('não retorna a transação quando a duração já expirou', async () => {
      await createTransaction({ ...TRANSACTION_BODY, start_month: 1, start_year: 2026, duration_months: 2 });

      const res = await request(app)
        .get(`/credit-cards/${cardId}/transactions?year=2026&month=3`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('não retorna transações de outro cartão do mesmo usuário', async () => {
      const otherCard = await createCard({ name: 'Inter', color: '#FF6600' });
      await pool.query(
        `INSERT INTO card_transactions (credit_card_id, description, value, date, start_month, start_year, duration_months)
         VALUES ($1, 'Transação do outro cartão', 100, '2026-04-01', 4, 2026, 1)`,
        [otherCard.id]
      );

      const res = await request(app)
        .get(`/credit-cards/${cardId}/transactions?year=2026&month=4`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('não retorna transações de cartão de outro usuário', async () => {
      const { rows } = await pool.query(
        `INSERT INTO users (name, email, password_hash) VALUES ('Outro', 'outro_tx@test.com', 'x') RETURNING *`
      );
      const otherUser = rows[0];
      const { rows: cardRows } = await pool.query(
        `INSERT INTO credit_cards (user_id, name) VALUES ($1, 'Cartão Alheio') RETURNING *`,
        [otherUser.id]
      );
      await pool.query(
        `INSERT INTO card_transactions (credit_card_id, description, value, date, start_month, start_year, duration_months)
         VALUES ($1, 'Transação alheia', 100, '2026-04-01', 4, 2026, 1)`,
        [cardRows[0].id]
      );

      const res = await request(app)
        .get(`/credit-cards/${cardRows[0].id}/transactions?year=2026&month=4`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);

      await pool.query('DELETE FROM users WHERE id = $1', [otherUser.id]);
    });
  });

  // ─── POST TRANSACTIONS ─────────────────────────────────────────────────────

  describe('Criar transação — POST /credit-cards/:cardId/transactions', () => {
    it('retorna 400 quando campos obrigatórios estão ausentes', async () => {
      const res = await request(app)
        .post(`/credit-cards/${cardId}/transactions`)
        .set('Authorization', `Bearer ${token}`)
        .send({ description: 'Sem valor' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message');
    });

    it('retorna 201 com a transação criada', async () => {
      const res = await request(app)
        .post(`/credit-cards/${cardId}/transactions`)
        .set('Authorization', `Bearer ${token}`)
        .send(TRANSACTION_BODY);

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({ description: 'Netflix', credit_card_id: cardId });
      expect(parseFloat(res.body.data.value)).toBe(45.90);
      expect(res.body.data.id).toBeDefined();
    });

    it('cria transação sem emoji quando o campo não é enviado', async () => {
      const { emoji, ...bodyWithoutEmoji } = TRANSACTION_BODY;

      const res = await request(app)
        .post(`/credit-cards/${cardId}/transactions`)
        .set('Authorization', `Bearer ${token}`)
        .send(bodyWithoutEmoji);

      expect(res.status).toBe(201);
      expect(res.body.data.emoji).toBeNull();
    });

    it('usa duration_months = 1 como padrão quando não é enviado', async () => {
      const { duration_months, ...bodyWithoutDuration } = TRANSACTION_BODY;

      const res = await request(app)
        .post(`/credit-cards/${cardId}/transactions`)
        .set('Authorization', `Bearer ${token}`)
        .send(bodyWithoutDuration);

      expect(res.status).toBe(201);
      expect(res.body.data.duration_months).toBe(1);
    });

    it('retorna 404 quando o cartão não pertence ao usuário', async () => {
      const { rows } = await pool.query(
        `INSERT INTO users (name, email, password_hash) VALUES ('Outro4', 'outro4_cc@test.com', 'x') RETURNING *`
      );
      const otherUser = rows[0];
      const { rows: cardRows } = await pool.query(
        `INSERT INTO credit_cards (user_id, name) VALUES ($1, 'Cartão Alheio') RETURNING *`,
        [otherUser.id]
      );

      const res = await request(app)
        .post(`/credit-cards/${cardRows[0].id}/transactions`)
        .set('Authorization', `Bearer ${token}`)
        .send(TRANSACTION_BODY);

      expect(res.status).toBe(404);

      await pool.query('DELETE FROM users WHERE id = $1', [otherUser.id]);
    });
  });

  // ─── PUT TRANSACTIONS ──────────────────────────────────────────────────────

  describe('Atualizar transação — PUT /credit-cards/:cardId/transactions/:id', () => {
    it('retorna 400 quando campos obrigatórios estão ausentes', async () => {
      const tx = await createTransaction();

      const res = await request(app)
        .put(`/credit-cards/${cardId}/transactions/${tx.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ description: 'Sem valor' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message');
    });

    it('retorna 404 quando a transação não existe', async () => {
      const res = await request(app)
        .put(`/credit-cards/${cardId}/transactions/999999`)
        .set('Authorization', `Bearer ${token}`)
        .send(TRANSACTION_BODY);

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('message');
    });

    it('retorna 200 com os dados atualizados', async () => {
      const tx = await createTransaction();

      const res = await request(app)
        .put(`/credit-cards/${cardId}/transactions/${tx.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ ...TRANSACTION_BODY, description: 'Spotify', value: 21.90 });

      expect(res.status).toBe(200);
      expect(res.body.data.description).toBe('Spotify');
      expect(parseFloat(res.body.data.value)).toBe(21.90);
    });

    it('não atualiza transação de outro cartão do mesmo usuário', async () => {
      const otherCard = await createCard({ name: 'Inter', color: '#FF6600' });
      const { rows: txRows } = await pool.query(
        `INSERT INTO card_transactions (credit_card_id, description, value, date, start_month, start_year, duration_months)
         VALUES ($1, 'Transação do outro cartão', 100, '2026-04-01', 4, 2026, 1) RETURNING *`,
        [otherCard.id]
      );

      const res = await request(app)
        .put(`/credit-cards/${cardId}/transactions/${txRows[0].id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(TRANSACTION_BODY);

      expect(res.status).toBe(404);
    });

    it('não atualiza transação de cartão de outro usuário', async () => {
      const { rows } = await pool.query(
        `INSERT INTO users (name, email, password_hash) VALUES ('Outro5', 'outro5_cc@test.com', 'x') RETURNING *`
      );
      const otherUser = rows[0];
      const { rows: cardRows } = await pool.query(
        `INSERT INTO credit_cards (user_id, name) VALUES ($1, 'Cartão Alheio') RETURNING *`,
        [otherUser.id]
      );
      const { rows: txRows } = await pool.query(
        `INSERT INTO card_transactions (credit_card_id, description, value, date, start_month, start_year, duration_months)
         VALUES ($1, 'Transação alheia', 100, '2026-04-01', 4, 2026, 1) RETURNING *`,
        [cardRows[0].id]
      );

      const res = await request(app)
        .put(`/credit-cards/${cardRows[0].id}/transactions/${txRows[0].id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(TRANSACTION_BODY);

      expect(res.status).toBe(404);

      await pool.query('DELETE FROM users WHERE id = $1', [otherUser.id]);
    });
  });

  // ─── MONTHLY TOTALS ────────────────────────────────────────────────────────

  describe('Totais mensais — GET /credit-cards/:cardId/transactions/monthly-totals', () => {
    it('retorna 400 quando year não é enviado', async () => {
      const res = await request(app)
        .get(`/credit-cards/${cardId}/transactions/monthly-totals`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message');
    });

    it('retorna 404 quando o cartão não pertence ao usuário', async () => {
      const { rows } = await pool.query(
        `INSERT INTO users (name, email, password_hash) VALUES ('Outro7', 'outro7_cc@test.com', 'x') RETURNING *`
      );
      const otherUser = rows[0];
      const { rows: cardRows } = await pool.query(
        `INSERT INTO credit_cards (user_id, name) VALUES ($1, 'Cartão Alheio') RETURNING *`,
        [otherUser.id]
      );

      const res = await request(app)
        .get(`/credit-cards/${cardRows[0].id}/transactions/monthly-totals?year=2026`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);

      await pool.query('DELETE FROM users WHERE id = $1', [otherUser.id]);
    });

    it('retorna 200 com 12 meses todos zerados quando não há transações', async () => {
      const res = await request(app)
        .get(`/credit-cards/${cardId}/transactions/monthly-totals?year=2026`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(12);
      expect(res.body.data.every(r => parseFloat(r.total) === 0)).toBe(true);
    });

    it('soma corretamente uma transação pontual em um único mês', async () => {
      await createTransaction({ ...TRANSACTION_BODY, value: 100, start_month: 4, start_year: 2026, duration_months: 1 });

      const res = await request(app)
        .get(`/credit-cards/${cardId}/transactions/monthly-totals?year=2026`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const april = res.body.data.find(r => r.month === 4);
      expect(parseFloat(april.total)).toBe(100);
      const others = res.body.data.filter(r => r.month !== 4);
      expect(others.every(r => parseFloat(r.total) === 0)).toBe(true);
    });

    it('distribui corretamente uma transação parcelada por múltiplos meses', async () => {
      await createTransaction({ ...TRANSACTION_BODY, value: 90, start_month: 3, start_year: 2026, duration_months: 3 });

      const res = await request(app)
        .get(`/credit-cards/${cardId}/transactions/monthly-totals?year=2026`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(parseFloat(res.body.data.find(r => r.month === 3).total)).toBe(90);
      expect(parseFloat(res.body.data.find(r => r.month === 4).total)).toBe(90);
      expect(parseFloat(res.body.data.find(r => r.month === 5).total)).toBe(90);
      expect(parseFloat(res.body.data.find(r => r.month === 6).total)).toBe(0);
    });

    it('não inclui transações de outro cartão do mesmo usuário', async () => {
      const otherCard = await createCard({ name: 'Inter', color: '#FF6600' });
      await pool.query(
        `INSERT INTO card_transactions (credit_card_id, description, value, date, start_month, start_year, duration_months)
         VALUES ($1, 'Transação do outro cartão', 500, '2026-04-01', 4, 2026, 999)`,
        [otherCard.id]
      );

      const res = await request(app)
        .get(`/credit-cards/${cardId}/transactions/monthly-totals?year=2026`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.every(r => parseFloat(r.total) === 0)).toBe(true);
    });
  });

  // ─── DELETE TRANSACTIONS ───────────────────────────────────────────────────

  describe('Remover transação — DELETE /credit-cards/:cardId/transactions/:id', () => {
    it('retorna 404 quando a transação não existe', async () => {
      const res = await request(app)
        .delete(`/credit-cards/${cardId}/transactions/999999`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('message');
    });

    it('retorna 200 e remove a transação corretamente', async () => {
      const tx = await createTransaction();

      const res = await request(app)
        .delete(`/credit-cards/${cardId}/transactions/${tx.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message');

      const { rows } = await pool.query('SELECT * FROM card_transactions WHERE id = $1', [tx.id]);
      expect(rows).toHaveLength(0);
    });

    it('não remove transação de outro cartão do mesmo usuário', async () => {
      const otherCard = await createCard({ name: 'Inter', color: '#FF6600' });
      const { rows: txRows } = await pool.query(
        `INSERT INTO card_transactions (credit_card_id, description, value, date, start_month, start_year, duration_months)
         VALUES ($1, 'Transação do outro cartão', 100, '2026-04-01', 4, 2026, 1) RETURNING *`,
        [otherCard.id]
      );

      const res = await request(app)
        .delete(`/credit-cards/${cardId}/transactions/${txRows[0].id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('não remove transação de cartão de outro usuário', async () => {
      const { rows } = await pool.query(
        `INSERT INTO users (name, email, password_hash) VALUES ('Outro6', 'outro6_cc@test.com', 'x') RETURNING *`
      );
      const otherUser = rows[0];
      const { rows: cardRows } = await pool.query(
        `INSERT INTO credit_cards (user_id, name) VALUES ($1, 'Cartão Alheio') RETURNING *`,
        [otherUser.id]
      );
      const { rows: txRows } = await pool.query(
        `INSERT INTO card_transactions (credit_card_id, description, value, date, start_month, start_year, duration_months)
         VALUES ($1, 'Transação alheia', 100, '2026-04-01', 4, 2026, 1) RETURNING *`,
        [cardRows[0].id]
      );

      const res = await request(app)
        .delete(`/credit-cards/${cardRows[0].id}/transactions/${txRows[0].id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);

      await pool.query('DELETE FROM users WHERE id = $1', [otherUser.id]);
    });
  });
});
