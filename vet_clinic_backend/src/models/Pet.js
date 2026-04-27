const mongoose = require('mongoose');

const petSchema = new mongoose.Schema({
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    name: { type: String, required: true },
    species: { type: String, enum: ['DOG', 'CAT', 'OTHER'], required: true },
    breed: { type: String },
    gender: { type: String, enum: ['MALE', 'FEMALE', 'UNKNOWN'] },
    age: { type: Number },
    weight: { type: Number },
    birthDate: { type: Date },
    avatar: { type: String },

    specialNotes: { type: String }, // Dị ứng, tiền sử bệnh
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true
});

module.exports = mongoose.model('Pet', petSchema);
