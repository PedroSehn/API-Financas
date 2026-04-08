const express = require('express');
const router = express.Router();
const simulationController = require('./simulation.controller');

router.post('/', simulationController.simulate);

module.exports = router;
