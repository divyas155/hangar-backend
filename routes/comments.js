// backend/routes/comments.js
const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const commentsController = require('../controllers/commentsController');

// ✅ GET comments by item ID and type (all authenticated users)
router.get('/', auth, commentsController.getComments);

// ✅ POST a new comment
router.post('/', auth, commentsController.postComment);

module.exports = router;
