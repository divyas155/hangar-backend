const express = require('express');
const router = express.Router();
const { auth, isAdmin } = require('../middleware/auth');

// 🧪 Test Reports Route - Admin Only

// GET route to test it works
router.get('/', auth, isAdmin, (req, res) => {
  res.json({ message: 'Test Reports route is active' });
});

// You can add POST/PUT/DELETE later if needed

module.exports = router;
