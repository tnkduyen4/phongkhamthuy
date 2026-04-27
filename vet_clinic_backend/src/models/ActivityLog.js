const mongoose = require('mongoose');

/**
 * Activity Log — Lịch sử hoạt động của từng tài khoản.
 * - Chỉ ghi tự động, KHÔNG cho phép sửa/xóa qua API.
 * - Admin có thể đọc theo từng userId.
 */
const activityLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    action: {
        type: String,
        required: true
        // Ví dụ: 'CANCEL_APPOINTMENT', 'UPDATE_STATUS', 'CREATE_APPOINTMENT', 'LOGIN', v.v.
    },
    targetModel: { type: String },     // 'Appointment', 'Invoice', etc.
    targetId: { type: mongoose.Schema.Types.ObjectId },
    description: { type: String, required: true },
    metadata: { type: mongoose.Schema.Types.Mixed },  // Dữ liệu phụ (lý do hủy, v.v.)
    ipAddress: { type: String },
}, {
    timestamps: true
});

// Index phụ để sort và tìm theo ngày
activityLogSchema.index({ userId: 1, createdAt: -1 });

// Tự động xóa rác Audit Log sau 60 ngày (5,184,000 giây)
activityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 24 * 60 * 60 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
