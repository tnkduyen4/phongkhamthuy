const express = require('express');
const {
    createAppointment, getAppointments, updateAppointmentStatus,
    rescheduleAppointment, confirmReschedule,
    cancelMyAppointment, rateAppointment, rescheduleByCustomer
} = require('../controllers/appointmentController');
const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

router.route('/')
    .post(protect, createAppointment)
    .get(protect, getAppointments);

// Nhân sự cập nhật trạng thái
router.route('/:id/status')
    .patch(protect, authorize('ADMIN', 'RECEPTIONIST', 'DOCTOR', 'GROOMER'), updateAppointmentStatus);

// Khách hàng hủy lịch (Admin có thể hủy thay khách)
router.route('/:id/cancel')
    .patch(protect, authorize('CUSTOMER', 'ADMIN', 'RECEPTIONIST'), cancelMyAppointment);

// Đánh giá sau khám
router.route('/:id/rate')
    .post(protect, rateAppointment);

// Staff đề xuất đổi lịch (chờ khách xác nhận)
router.route('/:id/reschedule')
    .patch(protect, authorize('ADMIN', 'RECEPTIONIST', 'DOCTOR'), rescheduleAppointment);

// Khách xác nhận hoặc từ chối đề xuất đổi lịch
router.route('/:id/reschedule-confirm')
    .patch(protect, confirmReschedule);

// Khách tự đổi lịch của chính mình (Admin có thể thay thế)
router.route('/:id/reschedule-self')
    .patch(protect, authorize('CUSTOMER', 'ADMIN'), rescheduleByCustomer);

module.exports = router;
