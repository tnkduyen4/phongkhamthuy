const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
    staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true }, // Ngày làm việc (Y-m-d)
    scheduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Schedule' },
    
    checkIn: {
        time: { type: Date },
        location: {
            lat: { type: Number },
            lng: { type: Number }
        },
        photo: { type: String }, // Base64 image
        isLate: { type: Boolean, default: false },
        lateMinutes: { type: Number, default: 0 }
    },
    
    checkOut: {
        time: { type: Date },
        location: {
            lat: { type: Number },
            lng: { type: Number }
        },
        photo: { type: String },
        isAuto: { type: Boolean, default: false }
    },
    
    status: {
        type: String,
        enum: ['PRESENT', 'ABSENT', 'LATE', 'ON_LEAVE'],
        default: 'PRESENT'
    },
    
    note: { type: String }
}, {
    timestamps: true
});

// Mỗi nhân viên chỉ có 1 record cho mỗi ca lịch trực
attendanceSchema.index({ staffId: 1, scheduleId: 1 }, { unique: true, sparse: true });
// Index phụ để query nhanh theo ngày
attendanceSchema.index({ staffId: 1, date: 1 });
attendanceSchema.index({ date: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
