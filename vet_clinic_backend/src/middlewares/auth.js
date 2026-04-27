const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware xác thực token
const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'vet_clinic_super_secret');

            req.user = await User.findById(decoded.id)
                .select('-password -editHistory -pushSubscriptions')
                .populate({
                    path: 'staffProfile',
                    select: '-verificationPhoto -faceResetRequest.pendingFacePhoto'
                })
                .populate('customerProfile');
            if (!req.user) {
                return res.status(401).json({ success: false, message: 'Người dùng không tồn tại' });
            }

            // Gắn flag hasVerificationPhoto mỏng nhẹ để frontend biết user đã có ảnh FaceID chưa,
            // mà không cần tải nguyên chuỗi Base64 62KB về.
            if (req.user.role !== 'CUSTOMER') {
                const StaffProfile = require('../models/StaffProfile');
                const hasPhoto = await StaffProfile.exists({ 
                    userId: req.user._id, 
                    verificationPhoto: { $exists: true, $ne: '' } 
                });
                
                // Convert req.user to object so we can add arbitrary fields and keep virtuals
                req.user = req.user.toObject({ virtuals: true });
                req.user.hasVerificationPhoto = req.user.role === 'ADMIN' ? true : !!hasPhoto;
                if (req.user.role === 'ADMIN') req.user.requiresPasswordChange = false;
            }

            next();
        } catch (error) {
            return res.status(401).json({ success: false, message: 'Không có quyền truy cập, token hỏng' });
        }
    }

    if (!token) {
        return res.status(401).json({ success: false, message: 'Không tìm thấy token đăng nhập' });
    }
};

// Middleware kiểm tra quyền hạn (Role-based)
const authorize = (...roles) => {
    return (req, res, next) => {
        const user = req.user;

        // 1. Kiểm tra Role cơ bản
        if (!roles.includes(user.role)) {
            return res.status(403).json({
                success: false,
                message: `Tài khoản ${user.role} không có quyền thực hiện hành động này.`
            });
        }

        next();
    };
};

module.exports = { protect, authorize };
