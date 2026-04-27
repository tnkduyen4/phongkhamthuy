const express = require('express');
const { createNotification, getMyNotifications, deleteAllMyNotifications, markAsRead, markAllRead, subscribePush, checkMyScheduleNotifications, checkExpiringMedicines } = require('../controllers/notificationController');
const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

router.use(protect);

router.post('/', authorize('ADMIN', 'RECEPTIONIST', 'DOCTOR', 'GROOMER'), createNotification);
router.get('/my', getMyNotifications);
router.delete('/my', deleteAllMyNotifications);
router.post('/check-my-schedule', checkMyScheduleNotifications);
router.post('/check-expiring-medicines', authorize('ADMIN', 'DOCTOR'), checkExpiringMedicines);
router.patch('/read-all', markAllRead);
router.patch('/:id/read', markAsRead);
router.post('/subscribe', subscribePush);

module.exports = router;
