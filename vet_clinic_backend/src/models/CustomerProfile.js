const mongoose = require('mongoose');

const customerProfileSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    address: { type: String },
    rewardPoints: { type: Number, default: 0 }
}, {
    timestamps: true
});

module.exports = mongoose.model('CustomerProfile', customerProfileSchema);
