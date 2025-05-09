const mongoose = require('mongoose');
//const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: function () {
      return !this.googleId; // Password is required only if not using Google OAuth
    }
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true
  },
  role: {
    type: String,
    enum: ['admin', 'site_engineer', 'paying_authority', 'viewer'], // include 'admin'
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

// 🔐 Hash password before saving (if modified and present)
//userSchema.pre('save', async function (next) {
  //if (!this.isModified('password') || !this.password) {
    //return next();
  //}

  //try {
    //const salt = await bcrypt.genSalt(10);
    //this.password = await bcrypt.hash(this.password, salt);
    //next();
  //} catch (error) {
    //next(error);
  //}
//});

// 🔍 Plain-text comparison (no hashing)
userSchema.methods.comparePassword = function(candidatePassword) {
  return Promise.resolve(candidatePassword === this.password);
};

module.exports = mongoose.model('User', userSchema);

