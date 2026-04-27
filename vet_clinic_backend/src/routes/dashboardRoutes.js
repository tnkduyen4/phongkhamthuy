const express = require('express');
const { getDashboardStats } = require('../controllers/dashboardController');
const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

router.get('/stats', protect, authorize('ADMIN'), getDashboardStats);

module.exports = router;
