const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: { type: String, required: [true, 'Vui lòng nhập Tên sản phẩm/vật tư'], unique: true },
    category: { type: String, enum: ['MEDICINE', 'SUPPLY', 'VACCINE'], default: 'MEDICINE' }, // Phân loại thuốc, vật tư hoặc vắc-xin
    unit: { type: String, required: [true, 'Vui lòng chọn hoặc nhập Đơn vị tính'] }, // Viên, Lọ, Gói...
    description: { type: String }, // Mô tả chung, chỉ định
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true
});

module.exports = mongoose.model('Product', productSchema);
