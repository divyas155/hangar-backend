// controllers/commentsController.js
const Comment = require('../models/Comment');

// GET /api/comments?itemId=...&type=...
exports.getComments = async (req, res) => {
  const { itemId, type } = req.query;

  if (!itemId || !type) {
    return res.status(400).json({ error: 'Missing itemId or type' });
  }

  try {
    const comments = await Comment.find({ itemId, type })
      .populate('user', 'username')
      .sort({ createdAt: -1 });

    res.json(comments);
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/comments
exports.postComment = async (req, res) => {
  const { itemId, type, text } = req.body;

  if (!itemId || !type || !text) {
    return res.status(400).json({ error: 'All fields required' });
  }

  try {
    const comment = await Comment.create({
      itemId,
      type,
      text,
      user: req.user._id,
    });

    const populated = await comment.populate('user', 'username');
    res.status(201).json(populated);
  } catch (error) {
    console.error('Error posting comment:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
