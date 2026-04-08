const express = require('express');
const router = express.Router();
const expensesController = require('./expenses.controller');

router.get('/',       expensesController.getByMonth);
router.post('/',      expensesController.create);
router.put('/:id',    expensesController.update);
router.delete('/:id', expensesController.remove);

module.exports = router;
