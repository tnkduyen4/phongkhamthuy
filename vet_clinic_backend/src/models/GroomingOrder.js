const mongoose = require('mongoose');

const groomingOrderSchema = new mongoose.Schema({
    orderId: { type: String, unique: true, required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Groomer phụ trách

    // Danh sách thú cưng cụ thể
    pets: [{
        petId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pet' },
        name: String,
        species: { type: String, enum: ['DOG', 'CAT', 'OTHER'] },
        weightAtVisit: Number,
        services: [{
            serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
            name: String,
            price: Number
        }]
    }],

    // Thống kê số lượng (tự động cập nhật hoặc lưu snapshot)
    dogCount: { type: Number, default: 0 },
    catCount: { type: Number, default: 0 },
    totalPets: { type: Number }, // Hook sẽ tự tính, không để required nữa

    // Dịch vụ thực hiện
    services: [{
        serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
        name: String,
        price: Number
    }],

    // Hình thức vận chuyển
    transportType: {
        type: String,
        enum: ['DROPOFF', 'PICKUP', 'PICKUP_RETURN'],
        default: 'DROPOFF'
    },

    // Quản lý ảnh & Trạng thái
    beforeImage: { type: String }, // URL ảnh check-in
    afterImage: { type: String },  // URL ảnh check-out
    checkinTime: { type: Date },
    checkoutTime: { type: Date },

    status: {
        type: String,
        enum: ['BOOKED', 'GROOMING', 'COMPLETED', 'CANCELLED'],
        default: 'BOOKED'
    },

    notes: { type: String }, // Ghi chú lúc đặt đơn
    completionNotes: { type: String }, // Ghi chú sau khi hoàn tất
    totalAmount: { type: Number, default: 0 },
    
    // Liên kết thanh toán
    medicalRecordId: { type: mongoose.Schema.Types.ObjectId, ref: 'MedicalRecord' },
    isPaid: { type: Boolean, default: false },

    // Liên kết lịch hẹn gốc (nếu tạo tự động từ booking)
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null }
}, { timestamps: true });

// Logic đếm số lượng thú cưng đã được đẩy ra Controller để tránh lỗi runtime

module.exports = mongoose.model('GroomingOrder', groomingOrderSchema);
