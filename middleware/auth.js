const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'antigravity_secret_jwt_key_2026_sports_3d_builder');

      let user = null;
      const isMongooseConnected = mongoose.connection.readyState === 1;
      const isValidObjectId = mongoose.Types.ObjectId.isValid(decoded.id);

      if (isMongooseConnected && isValidObjectId) {
        // Get user from database (excluding password)
        user = await User.findById(decoded.id).select('-password');
      }
      
      if (!user) {
        // Fallback for mock environment if user database gets flushed
        req.user = { _id: decoded.id, username: 'MockUser' };
      } else {
        req.user = user;
      }

      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token provided' });
  }
};

module.exports = { protect };

