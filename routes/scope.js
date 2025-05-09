const express = require('express');
const router = express.Router();
const { auth, isAdmin } = require('../middleware/auth');

// 📄 Scope of Work Routes (Admin Only)

// GET scope of work (example)
router.get('/', auth, isAdmin, (req, res) => {
  res.json({ message: 'Scope of Work endpoint ready' });
});

// You can later add POST/PUT/DELETE for managing scope details

module.exports = router;
