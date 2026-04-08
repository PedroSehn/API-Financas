const express = require('express');
const router = express.Router();
const controller = require('./credit-cards.controller');

router.get('/',       controller.getAll);
router.post('/',      controller.create);
router.put('/:id',    controller.update);
router.delete('/:id', controller.remove);

router.get('/:cardId/transactions',                controller.getTransactionsByMonth);
router.get('/:cardId/transactions/monthly-totals', controller.getMonthlyTotals);
router.post('/:cardId/transactions',               controller.createTransaction);
router.put('/:cardId/transactions/:id',            controller.updateTransaction);
router.delete('/:cardId/transactions/:id',         controller.removeTransaction);

module.exports = router;
