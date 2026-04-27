const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String },
    type: { type: String, enum: ['MEDICAL', 'GROOMING', 'PRODUCT', 'SURCHARGE'], required: true },
    price: { type: Number, required: true }, // Giá gốc
    estimatedDuration: { type: Number }, // Thời gian ước tính (phút) để dễ xếp lịch
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true
});

module.exports = mongoose.model('Service', serviceSchema);
