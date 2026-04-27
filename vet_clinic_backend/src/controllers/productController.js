const Product = require('../models/Product');
const logActivity = require('../utils/logActivity');

// @desc    Lấy danh sách tất cả Danh mục hàng hóa (Global)
// @route   GET /api/v1/products
// @access  Private
const getProducts = async (req, res) => {
    try {
        let query = {};
        if (req.query.category) {
            query.category = req.query.category;
        }
        if (req.query.search) {
            query.name = { $regex: req.query.search, $options: 'i' };
        }

        // Mặc định lọc bỏ những sản phẩm đã ngưng hoạt động (Soft Delete)
        if (!req.query.includeInactive) {
            query.isActive = { $ne: false };
        }

        const products = await Product.find(query).sort({ name: 1 });
        res.status(200).json({ success: true, count: products.length, data: products });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Tạo Danh mục hàng hóa mới
// @route   POST /api/v1/products
// @access  Private (Chỉ Admin, Manager)
const createProduct = async (req, res) => {
    try {
        const product = await Product.create(req.body);
        await logActivity({
            userId: req.user._id,
            action: 'CREATE_PRODUCT',
            description: `Tạo danh mục sản phẩm: ${product.name} (${product.category || ''})`,
            targetModel: 'Product', targetId: product._id,
            ipAddress: req.ip
        });

        res.status(201).json({ success: true, data: product });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: 'Tên danh mục này đã tồn tại trong hệ thống.' });
        }
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ success: false, message: messages.join(', ') });
        }
        res.status(500).json({ success: false, message: 'Lỗi máy chủ: ' + error.message });
    }
};

// @desc    Cập nhật Danh mục
// @route   PUT /api/v1/products/:id
// @access  Private (Chỉ Admin, Manager)
const updateProduct = async (req, res) => {
    try {
        const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        if (!product) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy Danh mục' });
        }

        await logActivity({
            userId: req.user._id,
            action: 'UPDATE_PRODUCT',
            description: `Cập nhật danh mục: ${product.name}`,
            targetModel: 'Product', targetId: req.params.id,
            ipAddress: req.ip
        });

        res.status(200).json({ success: true, data: product });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: 'Tên danh mục này đã tồn tại.' });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Xóa Danh mục
// @route   DELETE /api/v1/products/:id
// @access  Private (Chỉ Admin)
const deleteProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy Danh mục' });
        }

        // Soft delete: Đánh dấu ngừng kinh doanh danh mục này
        product.isActive = false;
        await product.save();

        await logActivity({
            userId: req.user._id,
            action: 'DELETE_PRODUCT',
            description: `Xóa danh mục sản phẩm: ${product.name}`,
            targetModel: 'Product', targetId: req.params.id,
            ipAddress: req.ip
        });

        res.status(200).json({ success: true, message: 'Xóa Danh mục thành công' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getProducts,
    createProduct,
    updateProduct,
    deleteProduct
};
