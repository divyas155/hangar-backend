const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');
require('dotenv').config(); // ✅ Load .env variables

passport.use(new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL // ✅ Now taken from .env
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // 🔍 Check if the user already exists
      let user = await User.findOne({ googleId: profile.id });

      // ➕ If not, create new user
      if (!user) {
        user = await User.create({
          googleId: profile.id,
          email: profile.emails[0].value,
          username: profile.displayName,
          role: 'user' // default role; can be changed later by admin
        });
      }

      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }
));

// 🔐 Serialize user for session support
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
