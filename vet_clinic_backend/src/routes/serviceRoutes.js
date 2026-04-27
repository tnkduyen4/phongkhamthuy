const express = require('express');
const { getServices, createService, updateService, deleteService, checkServiceDelete } = require('../controllers/serviceController');
const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

// Public: ai cũng có thể xem bảng giá dịch vụ (không cần đăng nhập)
router.get('/public', getServices);

// Xem danh sách dịch vụ (đã đăng nhập)
router.get('/', protect, getServices);

router.get('/:id/check-delete', protect, authorize('ADMIN'), checkServiceDelete);

// Sửa/Xóa/Thêm dịch vụ (Chỉ dành cho ADMIN)
router.post('/', protect, authorize('ADMIN'), createService);
router.put('/:id', protect, authorize('ADMIN'), updateService);
router.delete('/:id', protect, authorize('ADMIN'), deleteService);

module.exports = router;
