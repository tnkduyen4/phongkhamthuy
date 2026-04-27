const express = require('express');
const {
    createMedicalRecord,
    getPetMedicalHistory,
    getMedicalRecords
} = require('../controllers/medicalRecordController');
const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

// Bác sĩ, Manager, Admin được tạo bệnh án (Bác sĩ walk-in trực tiếp)
router.post('/', protect, authorize('DOCTOR', 'ADMIN'), createMedicalRecord);

// Lấy tất cả bệnh án (Admin/Manager xem tổng quan)
router.get('/', protect, authorize('ADMIN', 'DOCTOR'), getMedicalRecords);

// Khách hàng & Nhân viên được phép xem lại Lịch sử khám của 1 Pet
router.get('/pet/:petId', protect, getPetMedicalHistory);

module.exports = router;
