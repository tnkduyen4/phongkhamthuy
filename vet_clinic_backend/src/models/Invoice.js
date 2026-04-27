const mongoose = require('mongoose');

// Schema con: Hàng hóa bán lẻ trực tiếp (không qua kê đơn bệnh án)
const retailItemSchema = new mongoose.Schema({
    medicineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine' },
    productName: { type: String, required: true }, // Lưu tên để bảo toàn lịch sử
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    subtotal: { type: Number, required: true }
});

const invoiceSchema = new mongoose.Schema({
    // appointmentId là TÙY CHỌN: Có khi từ lịch hẹn, không có khi khám thẳng hoặc bán lẻ
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
    medicalRecordId: { type: mongoose.Schema.Types.ObjectId, ref: 'MedicalRecord' },
    groomingOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'GroomingOrder' },
    vaccinationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vaccination' },

    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receptionistId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Phân loại hóa đơn
    invoiceType: {
        type: String,
        enum: ['APPOINTMENT', 'WALKIN', 'RETAIL', 'GROOMING', 'VACCINATION'], // Lịch hẹn / Khám vãng lai / Bán lẻ / Làm đẹp / Tiêm phòng
        default: 'APPOINTMENT'
    },

    serviceTotal: { type: Number, default: 0 },   // Tiền khám/Grooming
    medicineTotal: { type: Number, default: 0 },  // Tiền thuốc từ đơn bác sĩ
    retailTotal: { type: Number, default: 0 },    // Tiền hàng hóa bán trực tiếp

    // Danh sách hàng bán lẻ (không qua bệnh án)
    retailItems: [retailItemSchema],

    depositAmount: { type: Number, default: 0 },
    discountCode: { type: String },
    discountAmount: { type: Number, default: 0 },
    pointsUsed: { type: Number, default: 0 },

    finalTotal: { type: Number, required: true },

    paymentMethod: { type: String, enum: ['CASH', 'TRANSFER', 'CARD'], default: 'CASH' },

    status: {
        type: String,
        enum: ['UNPAID', 'PAID', 'REFUNDED'],
        default: 'UNPAID'
    },

    notes: { type: String }
}, {
    timestamps: true
});

module.exports = mongoose.model('Invoice', invoiceSchema);
