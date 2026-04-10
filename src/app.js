const express = require('express');
const db = require('./config/database');
const app = express();

app.use(express.json());

// Rotas públicas
app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    console.log('[health] Conexão com o banco de dados OK');
    res.status(200).send('OK');
  } catch (err) {
    console.error('[health] Erro ao conectar no banco:', err);
    res.status(503).send();
  }
});
app.use('/auth',   require('./modules/auth/auth.routes'));

// Middlewares de autenticação
app.use(require('./middlewares/auth.middleware'));
app.use(require('./middlewares/demo.middleware'));

// Rotas protegidas
app.use('/users',       require('./modules/users/users.routes'));
app.use('/salary',      require('./modules/salary/salary.routes'));
app.use('/incomes',     require('./modules/incomes/incomes.routes'));
app.use('/expenses',    require('./modules/expenses/expenses.routes'));
app.use('/credit-cards',require('./modules/credit-cards/credit-cards.routes'));
app.use('/simulation',  require('./modules/simulation/simulation.routes'));
app.use('/dashboard',   require('./modules/dashboard/dashboard.routes'));

module.exports = app;