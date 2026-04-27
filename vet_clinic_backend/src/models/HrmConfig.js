const mongoose = require('mongoose');

// Lưu cấu hình phụ cấp HRM của toàn hệ thống
// Admin có thể thay đổi qua API/UI, hệ thống tự động áp dụng khi chốt lương
const hrmConfigSchema = new mongoose.Schema({
    role: {
        type: String,
        enum: ['DOCTOR', 'GROOMER', 'RECEPTIONIST', 'DEFAULT'],
        required: true,
        unique: true
    },
    // Lương cứng cơ bản mặc định cho bộ phận
    baseSalary: { type: Number, default: 0 },

    // Hoa hồng theo % doanh thu hóa đơn đã thanh toán
    commissionServiceRate: { type: Number, default: 0 },   // VD: 0.10 = 10%
    commissionMedicineRate: { type: Number, default: 0 },  // VD: 0.05 = 5%

    // Phụ cấp ca đêm (VNĐ / 1 ca NIGHT trong lịch trực)
    nightShiftAllowance: { type: Number, default: 0 },     // Lễ tân/Groomer: trực chiến

    // Dành riêng cho Bác sĩ On-call
    onCallFee: { type: Number, default: 0 },               // Phí gác sẵn sàng / đêm
    emergencyCaseFee: { type: Number, default: 0 },        // Phí mỗi ca cấp cứu thực tế

    // Cấu hình nhân sự tối thiểu cho ca đêm (Để kiểm soát khi phân lịch)
    nightShiftRequirements: {
        minDoctors: { type: Number, default: 1 },
        minAssistants: { type: Number, default: 1 }
    },

    // Chính sách phạt (của toàn hệ thống — áp dụng chung cho mọi bộ phận)
    // Lưu ở DEFAULT role và đọc từ đây khi tính lương
    latePenaltyPerMinute: { type: Number, default: 2000 },   // VD: 2000đ / phút trễ
    absentPenaltyPerDay: { type: Number, default: 100000 }   // VD: 100,000đ / ngày vắng không phép
}, {
    timestamps: true
});

module.exports = mongoose.model('HrmConfig', hrmConfigSchema);
