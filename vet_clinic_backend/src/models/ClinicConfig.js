const mongoose = require('mongoose');

const clinicConfigSchema = new mongoose.Schema({
    // Vị trí định vị tòa nhà phòng khám
    location: {
        lat: { type: Number, default: 10.762622 }, // Mặc định tọa độ 
        lng: { type: Number, default: 106.660172 },
        radius: { type: Number, default: 200 } // Bán kính cho phép (mét)
    },
    
    // Bản cài giờ làm việc các ca
    shifts: {
        DAY: { start: { type: String, default: "08:00" }, end: { type: String, default: "12:00" } },
        EVENING: { start: { type: String, default: "13:30" }, end: { type: String, default: "18:00" } },
        NIGHT: { start: { type: String, default: "18:00" }, end: { type: String, default: "08:00" } }
    },
    
    gracePeriod: { type: Number, default: 15 }, // Phút cho phép trễ
    latePenaltyPerMinute: { type: Number, default: 2000 }, // Phạt 2000đ mỗi phút trễ
    
    // Cho phép Face ID (Selfie Photo)
    requirePhoto: { type: Boolean, default: true },

    // Cấu hình Điểm tích luỹ
    rewardPointsConfig: {
        valuePerPoint: { type: Number, default: 1000 },
        maxPointsPerUse: { type: Number, default: 100 }
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('ClinicConfig', clinicConfigSchema);
