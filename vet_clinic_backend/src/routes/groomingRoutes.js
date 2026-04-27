const express = require('express');
const router = express.Router();
const {
    createGroomingOrder,
    checkInGrooming,
    checkOutGrooming,
    getGroomingOrders,
    deleteGroomingOrder,
    getGroomingOrdersByPet
} = require('../controllers/groomingController');
const { protect, authorize } = require('../middlewares/auth');

router.use(protect);

// Admin, Bác sĩ tạo đơn; Groomer tự tạo nếu nhận walk-in (Lễ tân không có quyền)
router.post('/', authorize('ADMIN', 'GROOMER', 'DOCTOR'), createGroomingOrder);
// Tất cả nhân viên liên quan xem được
router.get('/', authorize('ADMIN', 'RECEPTIONIST', 'GROOMER', 'DOCTOR'), getGroomingOrders);
// Chỉ Groomer và Admin được check-in / check-out (controller còn chặn thêm)
router.patch('/:id/check-in',  authorize('GROOMER', 'ADMIN'), checkInGrooming);
router.patch('/:id/check-out', authorize('GROOMER', 'ADMIN'), checkOutGrooming);
// Admin, Doctor mới được xóa (Lễ tân không có quyền)
router.delete('/:id', authorize('ADMIN', 'DOCTOR'), deleteGroomingOrder);
// Lấy danh sách Grooming theo pet (Khách hàng xem lịch sử)
router.get('/pet/:petId', authorize('CUSTOMER', 'ADMIN', 'RECEPTIONIST', 'GROOMER', 'DOCTOR'), getGroomingOrdersByPet);

module.exports = router;
