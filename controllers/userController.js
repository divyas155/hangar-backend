const User = require('../models/User');

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}, '-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;

    if (req.user.id === userId) {
      return res.status(400).json({ error: "Admins can't delete themselves" });
    }

    const deleted = await User.findByIdAndDelete(userId);
    if (!deleted) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted successfully', user: deleted });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password || !role) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    const newUser = new User({
      username,
      email,
      password,
      role,
      isActive: true,
    });

    await newUser.save();

    res.status(201).json({ message: 'User created successfully', user: newUser });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};
