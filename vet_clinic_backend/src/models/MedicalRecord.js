const mongoose = require('mongoose');

// Schema con: Định nghĩa 1 món thuốc trong Toa thuốc
const prescriptionSchema = new mongoose.Schema({
    medicineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', required: true },
    medicineName: { type: String },
    quantity: { type: Number, required: true },
    dosageInstructions: { type: String } // "Ngày 2 viên sau ăn"
});

// Schema chính: Hồ sơ bệnh án
const medicalRecordSchema = new mongoose.Schema({
    // appointmentId TÙY CHỌN: Walk-in không cần lịch hẹn trước
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },

    petId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pet', required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    weightAtVisit: { type: Number },
    temperature: { type: Number },

    symptoms: { type: String, required: true },
    diagnosis: { type: String, required: true },
    treatment: { type: String },

    // NHÚNG mảng toa thuốc
    prescriptions: [prescriptionSchema],

    // Mảng dịch vụ đã thực hiện
    services: [{
        serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
        name: { type: String },
        price: { type: Number }
    }],

    followUpDate: { type: Date }
}, {
    timestamps: true
});

module.exports = mongoose.model('MedicalRecord', medicalRecordSchema);
