const mongoose = require('mongoose');

const chatSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null // Null if it's a guest
  },
  guestId: {
    type: String,
    default: null // Used to track anonymous users via localStorage/cookies
  },
  status: {
    type: String,
    enum: ['active', 'human_intervention', 'closed'],
    default: 'active'
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { timestamps: true });

module.exports = mongoose.model('ChatSession', chatSessionSchema);
