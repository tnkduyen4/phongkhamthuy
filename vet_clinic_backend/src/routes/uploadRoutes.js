const express = require('express');
const { uploadImage } = require('../controllers/uploadController');
const { protect } = require('../middlewares/auth');
const { upload } = require('../config/cloudinary');

const router = express.Router();

// Sử dụng middleware `upload.single('image')` để parse file từ form-data (key là 'image')
// Endpoint yêu cầu phải đăng nhập (có token) mới được upload, chống spam đầy bộ nhớ.
router.post('/', protect, upload.single('image'), uploadImage);

module.exports = router;
