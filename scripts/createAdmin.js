// scripts/createAdmin.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config(); // Load MONGODB_URI from .env

async function createAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB');

    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.log('⚠️ Admin already exists. Aborting.');
      return process.exit(1);
    }

    const username = 'vijay';
    const email = 'hangar.20engr@gmail.com';
    const rawPassword = 'twenty@20'; // 🔐 You can change this before running

    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    const adminUser = new User({
      username,
      password: hashedPassword,
      email,
      role: 'admin',
      isActive: true
    });

    await adminUser.save();

    console.log(`✅ Admin account created:
- Username: ${username}
- Email: ${email}
- Password: ${rawPassword} (please change after first login)`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin:', error);
    process.exit(1);
  }
}

createAdmin();
