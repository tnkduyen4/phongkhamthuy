const express = require('express');
const { registerUser, loginUser, getMe, changeInitialPassword, claimAccount, forgotPassword, resetPassword } = require('../controllers/authController');
const { protect } = require('../middlewares/auth');

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/claim-account', claimAccount);         // Khách đã có SĐT trong hệ thống → tự đặt mật khẩu
router.post('/change-initial-password', protect, changeInitialPassword);
router.get('/me', protect, getMe);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;
