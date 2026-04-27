const mongoose = require('mongoose');

/**
 * Vaccination — Quản lý tiêm ngừa cho thú cưng.
 * Dùng để theo dõi các mũi tiêm đã thực hiện và lịch hẹn tiêm nhắc lại.
 */
const vaccinationSchema = new mongoose.Schema({
    petId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Pet',
        required: true,
        index: true
    },
    vaccineName: {
        type: String,
        required: true
    },
    medicineId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Medicine'
    },
    administeredDate: {
        type: Date,
        default: Date.now
    },
    nextDueDate: {
        type: Date,
        required: true
    },
    dosage: {
        type: String // VD: 1ml, 0.5 liều
    },
    doseNumber: {
        type: Number,
        default: 1
    },
    price: {
        type: Number,
        default: 0
    },
    batchNumber: {
        type: String // Số lô thuốc
    },
    doctorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    notes: {
        type: String
    },
    status: {
        type: String,
        enum: ['PENDING', 'PAID', 'COMPLETED', 'DUE', 'OVERDUE', 'CANCELLED'],
        default: 'PENDING'
    },
    appointmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Appointment',
        default: null
    },
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    services: [{
        serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
        name: String,
        price: { type: Number, default: 0 }
    }]
}, {
    timestamps: true
});

// Index để tìm nhanh các mũi tiêm sắp đến hạn
vaccinationSchema.index({ nextDueDate: 1 });

module.exports = mongoose.model('Vaccination', vaccinationSchema);
