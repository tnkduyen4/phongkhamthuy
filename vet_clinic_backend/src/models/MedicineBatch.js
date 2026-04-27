const mongoose = require('mongoose');

const medicineBatchSchema = new mongoose.Schema({
    medicineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', required: true },
    batchNumber: { type: String, required: true },  // VD: "A01", "B02"
    supplier: { type: String },                      // Nhà cung cấp
    quantity: { type: Number, required: true },      // SL còn lại của batch
    importedQty: { type: Number },                   // SL nhập ban đầu
    importDate: { type: Date, default: Date.now },
    expiryDate: { type: Date, required: true },      // Ngày hết hạn
    importPrice: { type: Number },
    isActive: { type: Boolean, default: true }       // false = đã dùng hết
}, { timestamps: true });

// Index FEFO: sắp xếp theo expiryDate tăng dần để xuất batch gần hết hạn trước
medicineBatchSchema.index({ medicineId: 1, expiryDate: 1 });

module.exports = mongoose.model('MedicineBatch', medicineBatchSchema);
