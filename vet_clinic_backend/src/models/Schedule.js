const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
    staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    shift: {
        type: String,
        enum: ['DAY', 'EVENING', 'NIGHT'],
        required: true
    },
    status: {
        type: String,
        enum: ['CONFIRMED', 'PENDING_CHANGE', 'CANCELLED'],
        default: 'CONFIRMED'
    },
    isOnCall: { type: Boolean, default: false } // Ca trực on-call cấp cứu
}, {
    timestamps: true
});

module.exports = mongoose.model('Schedule', scheduleSchema);
