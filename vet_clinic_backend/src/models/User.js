const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    phoneNumber: { type: String, required: true, unique: true }, // Khóa chính đăng nhập
    password: { type: String }, // Khách vãng lai tự tạo thì pass trống ban đầu
    fullName: { type: String, required: true },
    email: { type: String },
    avatar: { type: String },
    // Đánh dấu người này có hồ sơ khách hàng (Dùng cho Nhân sự có nuôi thú cưng)
    isCustomerProfile: { type: Boolean, default: false },

    role: {
        type: String,
        enum: ['ADMIN', 'DOCTOR', 'RECEPTIONIST', 'GROOMER', 'CUSTOMER'],
        default: 'CUSTOMER'
    },

    // Dành cho Web Push Notifications
    pushSubscriptions: [{
        endpoint: String,
        expirationTime: Number,
        keys: {
            p256dh: String,
            auth: String
        }
    }],

    isActive: { type: Boolean, default: true },
    requiresPasswordChange: { type: Boolean, default: false },
    resetPasswordOTP: { type: String },
    resetPasswordExpires: { type: Date },
    emailChangeOTP: { type: String },
    emailChangeExpires: { type: Date },
    pendingNewEmail: { type: String },
    editHistory: [{
        action: String,
        details: String,
        before: Object,
        after: Object,
        editedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        editedAt: { type: Date, default: Date.now }
    }]
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

userSchema.virtual('customerProfile', {
    ref: 'CustomerProfile',
    localField: '_id',
    foreignField: 'userId',
    justOne: true
});

userSchema.virtual('staffProfile', {
    ref: 'StaffProfile',
    localField: '_id',
    foreignField: 'userId',
    justOne: true
});

// ✅ VIRTUAL GETTERS để tương thích ngược với Frontend và các API cũ
userSchema.virtual('address').get(function() { return this.customerProfile?.address; });
userSchema.virtual('rewardPoints').get(function() { return this.customerProfile?.rewardPoints || 0; });

userSchema.virtual('baseSalary').get(function() { return this.staffProfile?.baseSalary || 0; });
userSchema.virtual('nightShiftAllowance').get(function() { return this.staffProfile?.nightShiftAllowance || 0; });
userSchema.virtual('onCallFee').get(function() { return this.staffProfile?.onCallFee || 0; });
userSchema.virtual('emergencyCaseFee').get(function() { return this.staffProfile?.emergencyCaseFee || 0; });
userSchema.virtual('hireDate').get(function() { return this.staffProfile?.hireDate; });
userSchema.virtual('verificationPhoto').get(function() { return this.staffProfile?.verificationPhoto; });
userSchema.virtual('faceResetRequest').get(function() { return this.staffProfile?.faceResetRequest; });

module.exports = mongoose.model('User', userSchema);
