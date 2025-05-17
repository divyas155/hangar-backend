const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true // Always required now (since Google login is removed)
  },
  role: {
    type: String,
    enum: ['admin', 'site_engineer', 'paying_authority', 'viewer'],
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// 🔐 Password hashing can be re-enabled later with bcrypt
/*
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});
*/

// 🔍 Plain-text password comparison (no hashing)
userSchema.methods.comparePassword = function(candidatePassword) {
  return Promise.resolve(candidatePassword === this.password);
};

module.exports = mongoose.model('User', userSchema);
