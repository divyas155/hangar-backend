// 🔐 Dependencies
const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * ✅ Authentication middleware:
 * - Extracts Bearer token from Authorization header
 * - Verifies JWT
 * - Attaches active user to req.user
 */
const auth = async (req, res, next) => {
  const authHeader = req.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const { userId } = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(userId).where({ isActive: true }).exec();
    if (!user) {
      return res.status(401).json({ message: 'User not found or inactive' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

/**
 * ✅ Role-based access middleware generator
 * @param {string[]} roles – array of allowed roles
 */
const checkRole = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    next();
  };
};

// ✅ Role shortcuts
const isAdmin           = checkRole(['admin']);
const isSiteEngineer    = checkRole(['site_engineer']);
const isPayingAuthority = checkRole(['paying_authority']);
const isViewer          = checkRole(['viewer']);

// ✅ Exports
module.exports = {
  auth,
  checkRole,
  isAdmin,
  isSiteEngineer,
  isPayingAuthority,
  isViewer
};
