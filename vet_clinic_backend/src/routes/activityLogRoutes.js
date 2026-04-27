const express = require('express');
const { getActivityLogs, getSystemActivityLogs } = require('../controllers/activityLogController');
const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

// Toàn bộ lịch sử hệ thống (Admin only) — ?date=YYYY-MM-DD&action=X&model=Y
router.get('/', protect, authorize('ADMIN'), getSystemActivityLogs);

// Lịch sử theo từng user (Admin only)
router.get('/:userId', protect, authorize('ADMIN'), getActivityLogs);

module.exports = router;
