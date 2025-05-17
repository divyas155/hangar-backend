const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  driveId:    { type: String, required: true },
  url:        { type: String, required: true },
  mimeType:   { type: String, required: true },
  filename:   { type: String, required: true },
  uploadedAt: { type: Date,   default: Date.now }
}, { _id: false });

const progressSchema = new mongoose.Schema({
  // 👇 NEW: Auto-incremented like Progress#1, Progress#2
  progressID: {
    type: String,
    required: true,
    unique: true
  },

  date: {
    type: Date,
    required: true
  },

  description: {
    type: String,
    required: true
  },

  // ZIP archive containing up to 10 photos + one video
  zip: {
    type: fileSchema,
    required: true
  },

  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },

  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  approvedAt: Date,

  comments: [{
    text: String,
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
});

module.exports = mongoose.model('Progress', progressSchema);
