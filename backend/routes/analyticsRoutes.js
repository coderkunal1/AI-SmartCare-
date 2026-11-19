const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const analyticsController = require('../controllers/analyticsController');

// GET /api/analytics/daily?days=7
router.get('/daily', auth, analyticsController.getDailyPatientsAndAppointments);

module.exports = router;
