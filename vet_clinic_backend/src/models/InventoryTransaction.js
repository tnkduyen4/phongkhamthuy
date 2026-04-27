const mongoose = require('mongoose');

const inventoryTransactionSchema = new mongoose.Schema({
    medicineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },

    transactionType: {
        type: String,
        enum: ['IMPORT', 'USAGE', 'ADJUSTMENT', 'DAMAGED'],
        required: true
    },

    quantity: { type: Number, required: true }, // Số lượng tương đối (âm/dương tùy loại) hoặc giá trị tuyệt đối?
    // Để tường minh, quantity sẽ lưu giá trị thay đổi (ex: 5, -2, 10). Nhưng ở đây lưu giá trị tuyệt đối (luôn >= 0)
    // Và transactionType sẽ quy định là Tăng hay Giảm (+/-).

    referenceId: { type: mongoose.Schema.Types.ObjectId }, // ID của chứng từ liên quan (Ví dụ: Invoice, MedicalRecord)

    notes: { type: String },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } // Nhân viên thao tác
}, {
    timestamps: true
});

module.exports = mongoose.model('InventoryTransaction', inventoryTransactionSchema);
