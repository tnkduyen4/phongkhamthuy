const express = require('express');
const { createInvoice, getInvoices } = require('../controllers/invoiceController');
const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

// Lễ tân, Quản lý, Bác sĩ (khi không có Lễ tân) được phép xuất hóa đơn
router.post('/', protect, authorize('ADMIN', 'RECEPTIONIST', 'DOCTOR'), createInvoice);
// GROOMER chỉ xem (không tạo) hóa đơn grooming của mình
router.get('/', protect, authorize('ADMIN', 'RECEPTIONIST', 'DOCTOR', 'GROOMER', 'CUSTOMER'), getInvoices);

module.exports = router;
