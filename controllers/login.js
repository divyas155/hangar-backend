// controllers/authController.js
const jwt    = require('jsonwebtoken');
const User   = require('../models/User');

exports.login = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const user = await User.findOne({ username });
  if (!user || !user.password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const match = await user.comparePassword(password);
  if (!match) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({ token, user: { id: user._id, username: user.username, role: user.role } });
};
