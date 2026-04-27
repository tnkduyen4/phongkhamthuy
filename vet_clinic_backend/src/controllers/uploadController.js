// @desc    Upload một hình ảnh (Avatar/Pet photo) lên Cloudinary
// @route   POST /api/v1/upload
// @access  Private (Dùng token để chống spam)
const uploadImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Vui lòng chọn một hình ảnh để tải lên' });
        }

        // Multer Storage Cloudinary sẽ tự động upload và trả về đường link ở req.file.path
        res.status(200).json({
            success: true,
            message: 'Tải ảnh lên thành công',
            data: {
                imageUrl: req.file.path, // Đây là URL cần lưu vào MongoDB
                publicId: req.file.filename // ID dùng để xóa ảnh sau này nếu cần
            }
        });
    } catch (error) {
        console.error('--- UPLOAD ERROR ---');
        console.dir(error); // Use dir for better object inspection
        res.status(500).json({ 
            success: false, 
            message: 'Lỗi Upload: ' + (error.message || 'Lỗi không xác định')
        });
    }
};

module.exports = { uploadImage };
