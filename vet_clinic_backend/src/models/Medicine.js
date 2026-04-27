const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true }, // Link tới CSDL gốc

    importPrice: { type: Number, required: [true, 'Vui lòng nhập Giá nhập (Cost)'] },
    retailPrice: { type: Number, required: [true, 'Vui lòng nhập Giá bán lẻ'] },

    stockQuantity: { type: Number, default: 0 },
    minimumStock: { type: Number, default: 5 },

    supplier: { type: String }, // Nhà cung cấp mặc định
    expiryDate: { type: Date },
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true
});

module.exports = mongoose.model('Medicine', medicineSchema);
