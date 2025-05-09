const express = require('express');
const router = express.Router();
const { getAllUsers, deleteUser, createUser } = require('../controllers/userController');
const { auth, isAdmin } = require('../middleware/auth');

router.get('/', auth, isAdmin, getAllUsers);
router.delete('/:id', auth, isAdmin, deleteUser);
router.post('/', auth, isAdmin, createUser);

module.exports = router;
