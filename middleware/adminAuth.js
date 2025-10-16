const jwt = require('jsonwebtoken');
const User = require('../models/User');

const adminAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ msg: 'No token, access denied' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || user.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied: Admin only' });
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(500).json({ msg: 'Server error: ' + err.message });
  }
};

module.exports = adminAuth;