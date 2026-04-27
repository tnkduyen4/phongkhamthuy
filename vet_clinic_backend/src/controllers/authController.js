const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const logActivity = require('../utils/logActivity');
const sendEmail = require('../utils/sendEmail');

const StaffProfile = require('../models/StaffProfile');
const CustomerProfile = require('../models/CustomerProfile');

// Hàm Helper tạo Token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'vet_clinic_super_secret', {
        expiresIn: '30d',
    });
};

// @desc    Khách hàng đăng ký tài khoản qua Mobile App
// @route   POST /api/v1/auth/register
// @access  Public
const registerUser = async (req, res) => {
    const { phoneNumber, password, fullName, email } = req.body;

    try {
        const userExists = await User.findOne({ phoneNumber });
        if (userExists) {
            // Nếu là Nhân viên và chưa có hồ sơ Khách hàng
            if (userExists.role !== 'CUSTOMER' && !userExists.isCustomerProfile) {
                userExists.isCustomerProfile = true;
                await userExists.save();

                return res.status(200).json({
                    success: true,
                    message: 'Nhân viên này đã được tạo thêm hồ sơ khách hàng',
                    data: {
                        _id: userExists._id,
                        fullName: userExists.fullName,
                        phoneNumber: userExists.phoneNumber,
                        role: userExists.role,
                        token: generateToken(userExists._id)
                    }
                });
            } else {
                // Đã là Customer hoặc đã có Customer Profile
                return res.status(400).json({ success: false, message: 'Số điện thoại này đã được sử dụng' });
            }
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = await User.create({
            phoneNumber,
            password: hashedPassword,
            fullName,
            email,
            role: 'CUSTOMER' // Mặc định tự đăng ký là Khách hàng
        });

        if (user) {
            res.status(201).json({
                success: true,
                data: {
                    _id: user._id,
                    fullName: user.fullName,
                    phoneNumber: user.phoneNumber,
                    role: user.role,
                    token: generateToken(user._id)
                }
            });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Đăng nhập (Dùng chung cho cả Web nhân viên và App khách)
// @route   POST /api/v1/auth/login
// @access  Public
const loginUser = async (req, res) => {
    const { phoneNumber, password } = req.body;

    try {
        const user = await User.findOne({ phoneNumber })
            .select('-editHistory -pushSubscriptions')
            .populate({
                path: 'staffProfile',
                select: '-verificationPhoto -faceResetRequest.pendingFacePhoto'
            });

        if (user && (await bcrypt.compare(password, user.password))) {
            // Chỉ ghi log đăng nhập của nhân viên (không ghi khách hàng)
            if (user.role !== 'CUSTOMER') {
                logActivity({
                    userId: user._id,
                    action: 'LOGIN',
                    description: `Đăng nhập hệ thống (${user.role})`,
                    ipAddress: req.ip
                }).catch(err => console.error("Login log error", err));
            }
            let hasVerificationPhoto = false;
            let StaffProfile = null;
            if (user.role !== 'CUSTOMER') {
                StaffProfile = require('../models/StaffProfile');
                hasVerificationPhoto = await StaffProfile.exists({ userId: user._id, verificationPhoto: { $exists: true, $ne: '' } });
            }

            res.json({
                success: true,
                data: {
                    _id: user._id,
                    fullName: user.fullName,
                    role: user.role,
                    token: generateToken(user._id),
                    requiresPasswordChange: user.role === 'ADMIN' ? false : user.requiresPasswordChange,
                    requiresFaceRegistration: (user.role !== 'CUSTOMER' && user.role !== 'ADMIN') && !hasVerificationPhoto
                }
            });
        } else {
            res.status(401).json({ success: false, message: 'Số điện thoại hoặc mật khẩu sai' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Thay đổi mật khẩu lần đầu (khi có flag requiresPasswordChange)
// @route   POST /api/v1/auth/change-initial-password
// @access  Private
const changeInitialPassword = async (req, res) => {
    try {
        const { newPassword, verificationPhoto } = req.body;
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ success: false, message: 'Mật khẩu mới phải từ 6 ký tự trở lên' });
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        user.requiresPasswordChange = false;
        
        if (verificationPhoto) {
            await StaffProfile.findOneAndUpdate(
                { userId: user._id },
                { verificationPhoto },
                { upsert: true }
            );
        }

        await user.save();

        await logActivity({
            userId: user._id,
            action: 'INITIAL_SETUP',
            description: 'Hoàn tất thiết lập tài khoản lần đầu (Mật khẩu + Khuôn mặt)',
            ipAddress: req.ip
        });

        res.status(200).json({ success: true, message: 'Tài khoản đã được kích hoạt thành công' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Lấy Profile của mình
// @route   GET /api/v1/auth/me
// @access  Private
const getMe = async (req, res) => {
    res.status(200).json({ success: true, data: req.user });
};

// @desc    Khách hàng kích hoạt tài khoản được lễ tân tạo (chưa có mật khẩu)
// @route   POST /api/v1/auth/claim-account
// @access  Public
const claimAccount = async (req, res) => {
    const { phoneNumber, password, fullName } = req.body;
    if (!phoneNumber || !password || password.length < 6) {
        return res.status(400).json({ success: false, message: 'Vui lòng cung cấp SĐT và mật khẩu ít nhất 6 ký tự.' });
    }
    try {
        const user = await User.findOne({ phoneNumber });
        if (!user) {
            return res.status(404).json({ success: false, message: 'Số điện thoại này chưa có trong hệ thống. Hãy đăng ký tài khoản mới.' });
        }
        if (user.password) {
            return res.status(400).json({ success: false, message: 'Tài khoản này đã được kích hoạt. Vui lòng đăng nhập bình thường.' });
        }
        if (user.role !== 'CUSTOMER') {
            return res.status(403).json({ success: false, message: 'Tài khoản nằm này không hỗ trợ kích hoạt theo luồng này.' });
        }
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);
        if (fullName && !user.fullName) user.fullName = fullName;
        await user.save();
        res.status(200).json({
            success: true,
            message: 'Tài khoản đã được kích hoạt thành công!',
            data: { _id: user._id, fullName: user.fullName, role: user.role, token: generateToken(user._id) }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Gửi mã OTP qua email để quên mật khẩu
// @route   POST /api/v1/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ success: false, message: 'Vui lòng cung cấp email đăng ký tài khoản.' });
    }

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản với email này.' });
        }

        // Tạo mã OTP 6 số ngẫu nhiên
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Lưu mã và thời gian hết hạn (15 phút)
        user.resetPasswordOTP = otp;
        user.resetPasswordExpires = Date.now() + 15 * 60 * 1000;
        await user.save({ validateBeforeSave: false });

        // Gửi email
        const message = `Chào ${user.fullName},\n\nMã xác thực (OTP) để lấy lại mật khẩu của bạn là: ${otp}\n\nMã này có hiệu lực trong vòng 15 phút.\nNếu bạn không yêu cầu thay đổi mật khẩu, xin vui lòng bỏ qua email này.\n\nTrân trọng,\nPhòng khám VetCare`;

        try {
            await sendEmail({
                email: user.email,
                subject: 'VetCare - Mã xác thực lấy lại mật khẩu',
                message
            });

            res.status(200).json({ success: true, message: 'Mã xác thực 6 số đã được gửi đến email của bạn.' });
        } catch (error) {
            user.resetPasswordOTP = undefined;
            user.resetPasswordExpires = undefined;
            await user.save({ validateBeforeSave: false });

            console.error('Email could not be sent', error);
            res.status(500).json({ success: false, message: 'Có lỗi xảy ra khi gửi email xác thực. Hãy thử lại.' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Đặt lại mật khẩu với OTP
// @route   POST /api/v1/auth/reset-password
// @access  Public
const resetPassword = async (req, res) => {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
        return res.status(400).json({ success: false, message: 'Vui lòng cung cấp email, mã hóa và mật khẩu mới.' });
    }
    if (newPassword.length < 6) {
        return res.status(400).json({ success: false, message: 'Mật khẩu mới phải từ 6 ký tự trở lên.' });
    }

    try {
        const user = await User.findOne({
            email,
            resetPasswordOTP: otp,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ success: false, message: 'Mã xác thực không đúng hoặc đã hết hạn.' });
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        user.resetPasswordOTP = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        if (user.role !== 'CUSTOMER') {
            logActivity({
                userId: user._id,
                action: 'PASSWORD_RESET',
                description: 'Đặt lại mật khẩu thông qua tính năng Quên mật khẩu',
                ipAddress: req.ip
            }).catch(err => console.error("Log error", err));
        }

        res.status(200).json({ success: true, message: 'Mật khẩu đã được đặt lại thành công! Bạn có thể đăng nhập ngay.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { registerUser, loginUser, getMe, changeInitialPassword, claimAccount, forgotPassword, resetPassword };
