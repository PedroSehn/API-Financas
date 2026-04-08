const express = require('express');
const router = express.Router();
const incomesController = require('./incomes.controller');

router.get('/',        incomesController.getByMonth);
router.post('/',       incomesController.create);
router.put('/:id',     incomesController.update);
router.delete('/:id',  incomesController.remove);

module.exports = router;
