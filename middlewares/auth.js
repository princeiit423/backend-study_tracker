const { getAuth } = require('@clerk/express');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { syncClerkUser } = require('../controllers/authController');

const protect = asyncHandler(async (req, res, next) => {
  const { userId } = getAuth(req);

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Not authorized' });
  }

  let user = await User.findOne({ clerkId: userId });

  if (!user) {
    const synced = await syncClerkUser(userId);
    user = synced.user;
  }

  req.user = user;
  req.clerkUserId = userId;
  next();
});

module.exports = { protect };
