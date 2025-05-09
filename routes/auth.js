const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const passport = require('passport');
const User = require('../models/User');
const { auth, isAdmin } = require('../middleware/auth');

// 🌐 Google OAuth2 Login
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// 🌐 Google OAuth2 Callback
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    const { _id, role } = req.user;
    const token = jwt.sign(
      { userId: _id, role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
  }
);

// 🔐 Local Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password required' });
    }

    const user = await User.findOne({ username });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// 👤 Admin-only: Create New User
router.post('/users', auth, isAdmin, async (req, res) => {
  try {
    const { username, password, email, role } = req.body;
    if (!username || !password || !email || !role) {
      return res.status(400).json({ message: 'All fields (username, password, email, role) are required' });
    }

    const exists = await User.findOne({ $or: [{ username }, { email }] });
    if (exists) {
      return res.status(400).json({ message: 'Username or email already exists' });
    }

    const user = new User({ username, password, email, role });
    await user.save();

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        email: user.email
      }
    });
  } catch (error) {
    console.error('User creation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// 🧾 Authenticated User Info
router.get('/me', auth, (req, res) => {
  res.json({
    id: req.user._id,
    username: req.user.username,
    role: req.user.role,
    email: req.user.email
  });
});

module.exports = router;
