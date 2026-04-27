const mongoose = require('mongoose');

const staffProfileSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    verificationPhoto: { type: String }, // Ảnh mẫu dùng để đối soát chấm công
    faceResetRequest: {
        requested: { type: Boolean, default: false },
        reason:    { type: String, default: '' },
        requestedAt: { type: Date },
        pendingFacePhoto: { type: String, default: '' } // Ảnh nhân viên tự chụp, chờ admin duyệt
    },
    baseSalary: { type: Number, default: 0 },
    nightShiftAllowance: { type: Number, default: 300000 }, // Phụ cấp mỗi ca trực chiến (Lễ tân)
    onCallFee: { type: Number, default: 100000 }, // Phí sẵn sàng trực gác tại nhà (Bác sĩ)
    emergencyCaseFee: { type: Number, default: 200000 }, // Tiền công mỗi ca chạy lên phòng khám
    hireDate: { type: Date, default: Date.now },
}, {
    timestamps: true
});

module.exports = mongoose.model('StaffProfile', staffProfileSchema);
