const express = require('express');
const router = express.Router();
const salaryController = require('./salary.controller');

router.get('/',  salaryController.get);
router.post('/', salaryController.create);
router.put('/',  salaryController.update);

module.exports = router;
