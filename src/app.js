const express = require('express');
const app = express();

app.use(express.json());

// Rotas públicas
app.use('/auth', require('./modules/auth/auth.routes'));

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

module.exports = app;