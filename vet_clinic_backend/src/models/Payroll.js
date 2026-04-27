const mongoose = require('mongoose');

const payrollSchema = new mongoose.Schema({
    staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    month: { type: Number, required: true }, // 1-12
    year: { type: Number, required: true },
    baseSalary: { type: Number, default: 0 },
    commissions: { type: Number, default: 0 }, // Tiền hoa hồng từ dịch vụ/thuốc
    bonus: { type: Number, default: 0 },
    deductions: { type: Number, default: 0 },
    workingDays: { type: Number, default: 0 },
    totalHoursWorked: { type: Number, default: 0 },
    lateCount: { type: Number, default: 0 },
    totalSalary: { type: Number, required: true },
    isPaid: { type: Boolean, default: false },
    isPublished: { type: Boolean, default: false },
    publishedAt: { type: Date },
    paymentDate: { type: Date },
    note: { type: String },
    // ―― Fields chi tiết để hiển thị trong modal ――
    hourlyRate:       { type: Number, default: 0 },  // Đơn giá giờ
    unpaidDays:       { type: Number, default: 0 },  // Số ngày nghỉ không lương
    latePenalty:      { type: Number, default: 0 },  // Tiền phạt đi trễ
    leaveDeduction:   { type: Number, default: 0 },  // Tiền khấu trừ nghỉ không lương
    totalLateMins:    { type: Number, default: 0 },  // Tổng phút trễ
    nightHoursWorked: { type: Number, default: 0 },  // Số giờ ca đêm
    nightShiftsCount: { type: Number, default: 0 },  // Số ca đêm
}, {
    timestamps: true
});

module.exports = mongoose.model('Payroll', payrollSchema);
