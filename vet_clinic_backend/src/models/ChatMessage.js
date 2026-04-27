const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatSession',
    required: true
  },
  sender: {
    type: String,
    enum: ['user', 'ai', 'staff'],
    required: true
  },
  content: {
    type: String, // The text message
    required: true 
  },
  isFunctionCall: {
    type: Boolean,
    default: false
  },
  functionData: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
