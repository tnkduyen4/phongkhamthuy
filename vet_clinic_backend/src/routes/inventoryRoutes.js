const express = require('express');
const {
    createMedicine, getMedicines, bulkCreateMedicines,
    updateMedicine, deleteMedicine, bulkDeleteMedicines, checkMedicineDelete,
    getTransactionHistory, addBatch, getBatches, getExpiringBatches, updateBatch,
    checkLowStockAll
} = require('../controllers/inventoryController');
const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

// Quét tồn kho thấp (ADMIN & DOCTOR đều có thể trigger)
router.post('/check-low-stock', protect, authorize('ADMIN', 'DOCTOR'), checkLowStockAll);

router.post('/medicines/bulk', protect, authorize('ADMIN'), bulkCreateMedicines);
router.post('/medicines/bulk-delete', protect, authorize('ADMIN'), bulkDeleteMedicines);

router.route('/medicines')
    .post(protect, authorize('ADMIN'), createMedicine)
    .get(protect, authorize('ADMIN', 'RECEPTIONIST', 'DOCTOR'), getMedicines);

router.route('/medicines/:id')
    .put(protect, authorize('ADMIN'), updateMedicine)
    .delete(protect, authorize('ADMIN'), deleteMedicine);

router.get('/medicines/:id/check-delete', protect, authorize('ADMIN'), checkMedicineDelete);

router.route('/medicines/:id/batches')
    .post(protect, authorize('ADMIN'), addBatch)
    .get(protect, authorize('ADMIN', 'DOCTOR'), getBatches);

router.patch('/batches/:batchId', protect, authorize('ADMIN'), updateBatch);
router.get('/batches/expiring', protect, authorize('ADMIN', 'DOCTOR'), getExpiringBatches);

router.get('/transactions', protect, authorize('ADMIN'), getTransactionHistory);

module.exports = router;
