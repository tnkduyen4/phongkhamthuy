const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { protect, authorize } = require('../middlewares/auth');

router.use(protect);

// Global Config
router.get('/config', attendanceController.getClinicConfig);
router.put('/config', authorize('ADMIN'), attendanceController.updateClinicConfig);

// Personal Actions
router.post('/check-in', attendanceController.checkIn);
router.post('/check-out', attendanceController.checkOut);
router.get('/my', attendanceController.getMyAttendance);

// Lấy danh sách ca hôm nay với trạng thái check-in
router.get('/today-shifts', attendanceController.getTodayShifts);

// Management
router.get('/all', authorize('ADMIN'), attendanceController.getAllAttendance);

// Đánh vắng tự động cho ca đã qua mà không chấm công (Admin)
router.post('/mark-absent', authorize('ADMIN'), attendanceController.markAbsentPastShifts);

// Sửa record ABSENT sai thành ON_LEAVE (chạy 1 lần để fix dữ liệu cũ)
router.post('/fix-absent-leaves', authorize('ADMIN'), attendanceController.fixWrongAbsentRecords);

module.exports = router;
