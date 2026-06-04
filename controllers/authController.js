const { clerkClient } = require('@clerk/express');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse, errorResponse } = require('../utils/response');

const getPrimaryEmail = (clerkUser) => {
  const primaryEmail = clerkUser.emailAddresses?.find(
    (email) => email.id === clerkUser.primaryEmailAddressId
  );
  return primaryEmail?.emailAddress || clerkUser.emailAddresses?.[0]?.emailAddress;
};

const getDisplayName = (clerkUser, email) => {
  const fullName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ').trim();
  return fullName || clerkUser.username || email?.split('@')[0] || 'AceStudy User';
};

const syncClerkUser = async (clerkId) => {
  const clerkUser = await clerkClient.users.getUser(clerkId);
  const email = getPrimaryEmail(clerkUser);

  if (!email) {
    throw new Error('Clerk account does not have an email address');
  }

  let user = await User.findOne({ $or: [{ clerkId }, { email: email.toLowerCase() }] });
  const isNewUser = !user;

  if (!user) {
    user = await User.create({
      clerkId,
      email,
      name: getDisplayName(clerkUser, email),
      avatar: clerkUser.imageUrl || '',
      isOnboarded: false,
    });
  } else {
    user.clerkId = clerkId;
    user.email = email;
    user.name = user.name || getDisplayName(clerkUser, email);
    if (clerkUser.imageUrl && !user.avatar) user.avatar = clerkUser.imageUrl;
    await user.save();
  }

  return { user, isNewUser };
};

// @desc    Sync signed-in Clerk user with Mongo profile
// @route   POST /api/auth/sync
const syncUser = asyncHandler(async (req, res) => {
  const clerkId = req.clerkUserId;

  if (!clerkId) {
    return errorResponse(res, 'Not authorized', 401);
  }

  const { user, isNewUser } = await syncClerkUser(clerkId);

  return successResponse(
    res,
    { user: user.toPublicJSON(), isNewUser },
    isNewUser ? 'Account created successfully' : 'Signed in successfully',
    isNewUser ? 201 : 200
  );
});

// @desc    Logout acknowledgement. Clerk handles session sign-out on the frontend.
// @route   POST /api/auth/logout
const logout = asyncHandler(async (req, res) => {
  return successResponse(res, {}, 'Logged out successfully');
});

// @desc    Get current user
// @route   GET /api/auth/me
const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  return successResponse(res, { user: user.toPublicJSON() }, 'User retrieved');
});

module.exports = { syncUser, logout, getMe, syncClerkUser };
