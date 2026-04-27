const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema({
    staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    type: {
        type: String,
        enum: ['SICK', 'VACATION', 'PERSONAL', 'UNPAID'],
        default: 'PERSONAL'
    },
    reason: { type: String },
    status: {
        type: String,
        enum: ['PENDING', 'APPROVED', 'REJECTED'],
        default: 'PENDING'
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
    timestamps: true
});

module.exports = mongoose.model('Leave', leaveSchema);
