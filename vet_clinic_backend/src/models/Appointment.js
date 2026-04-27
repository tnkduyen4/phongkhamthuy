const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    petId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pet', required: true }, // pet chính (backward compat)
    petIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Pet' }], // nhiều thú cưng (GROOMING)

    staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // BS hoặc Groomer được Lễ tân phân công
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' }, // gói chính / backward compat
    serviceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Service' }], // multi-service (Grooming)

    type: { type: String, enum: ['MEDICAL', 'GROOMING'], required: true },
    category: {
        type: String,
        enum: ['REGULAR', 'FOLLOW_UP', 'WALKIN', 'VACCINATION'],
        default: 'REGULAR'
    },

    // ── Nguồn tạo lịch hẹn ───────────────────────────────────────────────────
    bookingSource: {
        type: String,
        enum: [
            'CUSTOMER_APP',  // Khách tự đặt qua app
            'RECEPTIONIST',  // Lễ tân tạo tại quầy / qua điện thoại
            'DOCTOR',        // Bác sĩ tạo sau khi khám (tái khám, tiêm phòng)
            'SYSTEM'         // Hệ thống tự tạo (nhắc lịch định kỳ)
        ],
        default: 'CUSTOMER_APP'
    },
    createdByStaffId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Nhân viên tạo (nếu không phải khách)
    // ─────────────────────────────────────────────────────────────────────────

    date: { type: Date, required: true },
    timeSlot: { type: String, required: true },

    status: {
        type: String,
        enum: ['BOOKED', 'ARRIVED', 'IN_PROGRESS', 'READY_FOR_PAYMENT', 'COMPLETED', 'CANCELLED', 'RESCHEDULE_PENDING'],
        default: 'BOOKED'
    },

    // Thông tin đổi lịch chờ khách xác nhận
    proposedDate: { type: Date },
    proposedTimeSlot: { type: String },
    proposedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rescheduleNote: { type: String },

    depositAmount: { type: Number, default: 0 },

    // Dịch vụ đưa rước (chỉ áp dụng cho lịch GROOMING do Lễ tân tạo)
    deliveryType: {
        type: String,
        enum: ['NONE', 'PICKUP_AND_RETURN', 'PICKUP_ONLY', 'RETURN_ONLY'],
        default: 'NONE'
    },
    pickupAddress: { type: String },
    returnAddress: { type: String },

    cancelReason: { type: String },
    customerNotes: { type: String },
    staffNotes: { type: String },

    // Đánh giá sau khi khám
    rating: { type: Number, min: 1, max: 5 },
    ratingFeedback: { type: String },
}, {
    timestamps: true
});

module.exports = mongoose.model('Appointment', appointmentSchema);
