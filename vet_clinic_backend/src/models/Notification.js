const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, enum: ['ADMIN', 'DOCTOR', 'RECEPTIONIST'] },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, enum: ['INFO', 'EMERGENCY', 'WARNING', 'FACE_RESET', 'FACE_APPROVED', 'FACE_REJECTED', 'SHIFT_REMINDER', 'CHECKOUT_REMINDER', 'LATE_APPOINTMENT', 'NO_SHOW', 'TICKET_NEW', 'TICKET_RESOLVED'], default: 'INFO' },
    link: { type: String },
    isRead: { type: Boolean, default: false },
    metadata: { type: mongoose.Schema.Types.Map, of: String },
    deletedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, {
    timestamps: true
});

// Tự động xóa rác Notification sau 30 ngày (2,592,000 giây)
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('Notification', notificationSchema);
