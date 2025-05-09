const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  itemId: { type: mongoose.Schema.Types.ObjectId, required: true },
  type: { type: String, enum: ['progress', 'payment'], required: true },
  text: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Comment', commentSchema);
