const mongoose = require('mongoose');
const { Schema } = mongoose;

const paymentSchema = new Schema({
  paymentID:   { type: String, required: true, unique: true },
  date:        { type: Date,   required: true },
  amount:      { type: Number, required: true },
  description: { type: String },
  remarks:     { type: String },
  createdBy:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
  
  // ✅ Status field replaces 'approved'
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },

  approvedBy:  { type: Schema.Types.ObjectId, ref: 'User' },
  approvedAt:  { type: Date },

  comments: [{
    text:      { type: String },
    user:      { type: Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
