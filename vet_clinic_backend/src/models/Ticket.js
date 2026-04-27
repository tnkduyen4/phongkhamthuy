const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    
    // Loại khiếu nại/hỗ trợ
    category: { 
        type: String, 
        enum: ['ATTENDANCE', 'FACE_ID', 'SERVICE', 'STAFF', 'BILLING', 'APPOINTMENT', 'PAYROLL', 'OTHER'],
        required: true 
    },
    
    // Thông tin chi tiết
    subject: { type: String, required: true },
    content: { type: String, required: true },
    
    // Liên kết với chứng từ cụ thể (Hóa đơn, Lịch hẹn, Chấm công, Bệnh án, Grooming, Tiêm phòng, Lương...)
    referenceType: { 
        type: String, 
        enum: ['Attendance', 'Invoice', 'Appointment', 'Leave', 'Payroll', 'MedicalRecord', 'GroomingOrder', 'Vaccination', null],
        default: null
    },
    referenceId: { type: mongoose.Schema.Types.ObjectId, refPath: 'referenceType', default: null },
    
    // Trạng thái xử lý
    status: { 
        type: String, 
        enum: ['PENDING', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'],
        default: 'PENDING'
    },
    
    // Hình minh chứng (nếu có)
    attachment: { type: String },
    
    // Phản hồi từ Admin
    adminNote: { type: String },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: { type: Date }
    
}, {
    timestamps: true
});

// Index để load nhanh theo sender (lịch sử gửi của Khách/Nhân viên)
ticketSchema.index({ senderId: 1, createdAt: -1 });
// Index để Admin load danh sách chờ duyệt nhanh
ticketSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Ticket', ticketSchema);
