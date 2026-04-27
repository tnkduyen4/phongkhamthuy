const express = require('express');
const rateLimit = require('express-rate-limit');
const { 
    getUsers, getUserById, createStaff, updateUser, deleteUser, checkUserDelete, bulkDeleteUsers, quickCreateCustomer, reactivateUser,
    getMyProfile, updateMyProfile, updateMyPassword,
    requestFaceReset, adminResetFacePhoto, adminRejectFacePhoto,
    requestEmailChange, verifyEmailChange
} = require('../controllers/userController');
const { protect, authorize } = require('../middlewares/auth');
const User = require('../models/User');

const router = express.Router();

// Nhân viên nội bộ được xem danh sách Users (Bác sĩ, Groomer được xem để hỗ trợ Lễ tân)
router.get('/', protect, authorize('ADMIN', 'RECEPTIONIST', 'DOCTOR', 'GROOMER'), getUsers);
router.get('/:id', protect, authorize('ADMIN', 'RECEPTIONIST', 'DOCTOR', 'GROOMER'), getUserById);

// Xóa hàng loạt User (Phải đặt trước /:id)
router.post('/bulk-delete', protect, authorize('ADMIN', 'MANAGER'), bulkDeleteUsers);

// Kiểm tra liên kết trước khi xóa (Chỉ Admin)
router.get('/:id/check-delete', protect, authorize('ADMIN'), checkUserDelete);

// Chỉ Admin và Quản lý mới được tạo tài khoản cho nhân viên
router.post('/staff', protect, authorize('ADMIN'), createStaff);

// Tạo nhanh khách hàng walk-in (Bác sĩ, Lễ tân)
router.post('/quick-customer', protect, authorize('ADMIN', 'RECEPTIONIST', 'DOCTOR'), quickCreateCustomer);

// Tuyến đường tự quản lý cá nhân (Profile)
router.get('/me/profile', protect, getMyProfile);
router.put('/me/profile', protect, updateMyProfile);
router.put('/me/password', protect, updateMyPassword);
const emailOtpLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 phút
    max: 1, // Chỉ cho phép 1 request
    message: { success: false, message: 'Bạn thao tác quá nhanh. Vui lòng đợi 1 phút trước khi yêu cầu gửi mã mới.' }
});

router.post('/me/request-email-change', protect, emailOtpLimiter, requestEmailChange);
router.post('/me/verify-email-change', protect, verifyEmailChange);

// FaceID Reset Flow
router.post('/me/face-reset-request', protect, requestFaceReset);

// ── Lấy ảnh FaceID của nhân viên KHÁC để frontend kiểm tra trùng khuôn mặt ──
// Chỉ trả về _id, fullName, verificationPhoto (loại bản thân + loại CUSTOMER)
router.get('/me/other-face-photos', protect, async (req, res) => {
    try {
        const others = await User.find({
            _id: { $ne: req.user._id },
            role: { $ne: 'CUSTOMER' },
            verificationPhoto: { $exists: true, $nin: [null, ''] },
            isActive: { $ne: false }
        }).select('_id fullName verificationPhoto');

        res.json({ success: true, data: others });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── Lịch sử yêu cầu của nhân viên ──
router.get('/me/requests', protect, async (req, res) => {
    try {
        const ActivityLog = require('../models/ActivityLog');
        const Leave = require('../models/Leave');

        // 1. FaceID requests (từ ActivityLog của chính nhân viên)
        const faceLogs = await ActivityLog.find({
            userId: req.user._id,
            action: { $in: ['REQUEST_FACE_RESET', 'CHANGE_PASSWORD', 'UPDATE_PROFILE'] }
        })
        .select('action description createdAt metadata')
        .sort({ createdAt: -1 })
        .limit(50);

        // 2. Kết quả duyệt FaceID (admin action nhắm vào user này)
        const faceResults = await ActivityLog.find({
            targetId: req.user._id,
            action: { $in: ['ADMIN_RESET_FACE', 'ADMIN_REJECT_FACE'] }
        })
        .select('action description createdAt userId')
        .populate('userId', 'fullName')
        .sort({ createdAt: -1 })
        .limit(20);

        // 3. Đơn nghỉ phép của nhân viên
        const leaves = await Leave.find({ staffId: req.user._id })
            .select('startDate endDate reason type status createdAt approvedBy')
            .populate('approvedBy', 'fullName')
            .sort({ createdAt: -1 })
            .limit(30);

        // 4. Các Ticket hỗ trợ/khiếu nại
        const Ticket = require('../models/Ticket');
        const tickets = await Ticket.find({ senderId: req.user._id })
            .select('category subject content status adminNote createdAt attachment referenceId')
            .populate('referenceId')
            .sort({ createdAt: -1 })
            .limit(30);

        // Gộp thành mảng chung, sort theo thời gian
        const requests = [
            ...faceLogs.map(l => ({
                _id: l._id,
                category: l.action === 'REQUEST_FACE_RESET' ? 'FACE_ID'
                         : l.action === 'CHANGE_PASSWORD' ? 'PASSWORD'
                         : 'PROFILE',
                action: l.action,
                title: l.action === 'REQUEST_FACE_RESET' ? 'Yêu cầu cập nhật ảnh FaceID'
                     : l.action === 'CHANGE_PASSWORD' ? 'Đổi mật khẩu'
                     : 'Cập nhật thông tin cá nhân',
                description: l.description,
                status: 'SENT',
                createdAt: l.createdAt
            })),
            ...faceResults.map(l => ({
                _id: l._id,
                category: 'FACE_ID',
                action: l.action,
                title: l.action === 'ADMIN_RESET_FACE' ? 'FaceID được duyệt' : 'FaceID bị từ chối',
                description: l.description,
                status: l.action === 'ADMIN_RESET_FACE' ? 'APPROVED' : 'REJECTED',
                processedBy: l.userId?.fullName,
                createdAt: l.createdAt
            })),
            ...leaves.map(l => ({
                _id: l._id,
                category: 'LEAVE',
                action: 'LEAVE_REQUEST',
                title: `Đơn nghỉ phép (${l.type === 'PAID' ? 'Có lương' : 'Không lương'})`,
                description: l.reason || 'Không có lý do',
                status: l.status,
                startDate: l.startDate,
                endDate: l.endDate,
                processedBy: l.approvedBy?.fullName,
                createdAt: l.createdAt
            })),
            ...tickets.map(t => ({
                _id: t._id,
                category: t.category,
                action: 'TICKET',
                title: t.subject,
                description: t.content,
                status: t.status === 'PENDING' ? 'PENDING' : t.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : t.status === 'RESOLVED' ? 'APPROVED' : 'REJECTED',
                adminNote: t.adminNote,
                attachment: t.attachment,
                createdAt: t.createdAt
            }))
        ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 50);

        res.json({ success: true, data: requests });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// API Cập nhật và Xóa (đặt SAU /me/* để tránh route conflict)
router.put('/:id', protect, authorize('ADMIN', 'RECEPTIONIST'), updateUser);
router.delete('/:id', protect, authorize('ADMIN'), deleteUser);
router.patch('/:id/reactivate', protect, authorize('ADMIN'), reactivateUser);
router.put('/:id/face-reset-approve', protect, authorize('ADMIN'), adminResetFacePhoto);
router.put('/:id/admin-reset-face',   protect, authorize('ADMIN'), adminResetFacePhoto); // alias
router.put('/:id/admin-reject-face',  protect, authorize('ADMIN'), adminRejectFacePhoto);

// Lấy đầy đủ faceResetRequest (kể cả ảnh base64 lớn) cho modal duyệt của Admin
router.get('/:id/face-reset-detail', protect, authorize('ADMIN'), async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .select('fullName role email phoneNumber -verificationPhoto') // Strip root photo bug
            .populate('staffProfile');

        if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy nhân viên.' });

        // Map virtual values correctly to JSON since it is pulled from staffProfile
        const json = user.toJSON({ virtuals: true });
        if (json.staffProfile) {
            json.verificationPhoto = json.staffProfile.verificationPhoto;
            json.faceResetRequest = json.staffProfile.faceResetRequest;
        }

        res.json({ success: true, data: json });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
