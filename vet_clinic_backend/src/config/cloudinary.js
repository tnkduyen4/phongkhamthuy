const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
require('dotenv').config();

// Kiểm tra cấu hình Cloudinary (Debug)
console.log('--- CLOUDINARY DEBUG ---');
console.log('CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME || 'MISSING');
console.log('API_KEY:', process.env.CLOUDINARY_API_KEY ? 'Present (Starts with ' + process.env.CLOUDINARY_API_KEY.substring(0,3) + '...)' : 'MISSING');

if (!process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_CLOUD_NAME) {
    console.error('❌ LỖI: Thiếu cấu hình Cloudinary trong .env');
}

// Cấu hình Cloudinary bằng biến môi trường
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Cấu hình Multer Storage đẩy thẳng lên Cloudinary
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'vet_clinic_assets', // Tên folder trên Cloudinary
        allowedFormats: ['jpg', 'png', 'jpeg', 'webp'],
        transformation: [{ width: 800, height: 800, crop: 'limit' }] // Tự động resize để giảm dung lượng
    }
});

const upload = multer({ storage: storage });

module.exports = { cloudinary, upload };
