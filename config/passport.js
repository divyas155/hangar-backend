const passport = require('passport');
const User = require('../models/User');

// ✅ No Google OAuth Strategy configured anymore

// 🔐 Serialize user for session support (optional, if sessions are used)
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// 🔓 Deserialize user
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;
