const express = require('express');
const router = express.Router();
const hrmController = require('../controllers/hrmController');
const { protect, authorize } = require('../middlewares/auth');

router.use(protect);

// HRM Config (Admin cấu hình phụ cấp theo Role)
router.get('/configs', authorize('ADMIN'), hrmController.getHrmConfigs);
router.put('/configs/all', authorize('ADMIN'), hrmController.bulkUpdateConfigs);
router.put('/configs/:role', authorize('ADMIN'), hrmController.upsertHrmConfig);

// Schedules
router.get('/duty-staff', authorize('ADMIN', 'DOCTOR', 'RECEPTIONIST'), hrmController.getDutyStaff);
router.post('/schedules/sync', authorize('ADMIN'), hrmController.syncSchedules);
router.post('/schedules/bulk', authorize('ADMIN'), hrmController.bulkCreateSchedules);
router.get('/schedules', authorize('ADMIN', 'DOCTOR', 'RECEPTIONIST'), hrmController.getSchedules);
router.post('/schedules', authorize('ADMIN'), hrmController.createSchedule);
router.put('/schedules/:id', authorize('ADMIN'), hrmController.updateSchedule);
router.delete('/schedules/:id', authorize('ADMIN'), hrmController.deleteSchedule);

// Leaves
router.get('/leaves', authorize('ADMIN', 'DOCTOR', 'RECEPTIONIST'), hrmController.getLeaveRequests);
router.post('/leaves', authorize('ADMIN', 'DOCTOR', 'RECEPTIONIST'), hrmController.createLeaveRequest);
router.put('/leaves/:id', authorize('ADMIN'), hrmController.updateLeaveStatus);

// Payroll
router.get('/payrolls', authorize('ADMIN'), hrmController.getPayrolls);
router.get('/payrolls/my', authorize('ADMIN', 'DOCTOR', 'RECEPTIONIST', 'GROOMER'), hrmController.getMyPayrolls); // Nhân viên xem lương của mình
router.get('/my-commissions', authorize('ADMIN', 'DOCTOR', 'RECEPTIONIST', 'GROOMER'), hrmController.getMyCommissions); // Xem chi tiết hóa đơn hoa hồng
router.post('/payrolls/preview', authorize('ADMIN'), hrmController.previewPayroll);
router.post('/payrolls/generate', authorize('ADMIN'), hrmController.generatePayroll);
router.delete('/payrolls/month', authorize('ADMIN'), hrmController.deletePayrollByMonth);
router.put('/payrolls/:id/publish', authorize('ADMIN'), hrmController.publishPayroll); // Công bố bảng lương
router.put('/payrolls/:id', authorize('ADMIN'), hrmController.updatePayroll);

module.exports = router;
