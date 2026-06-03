const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse, errorResponse } = require('../utils/response');

// @desc    Complete onboarding
// @route   POST /api/users/onboard
const completeOnboarding = asyncHandler(async (req, res) => {
  const {
    timezone,
    preferences,
    theme,
  } = req.body;

  const user = await User.findById(req.user._id);

  if (timezone) user.timezone = timezone;
  if (preferences) user.preferences = { ...user.preferences, ...preferences };
  if (theme) user.theme = { ...user.theme, ...theme };
  user.isOnboarded = true;

  await user.save();

  return successResponse(res, { user: user.toPublicJSON() }, 'Onboarding completed');
});

// @desc    Update user profile
// @route   PUT /api/users/profile
const updateProfile = asyncHandler(async (req, res) => {
  const allowedFields = ['name', 'bio', 'phone', 'timezone', 'preferences', 'theme', 'dashboardLayout', 'isPublicProfile', 'showOnLeaderboard', 'notificationSettings'];
  const updates = {};

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      if (['preferences', 'theme', 'notificationSettings'].includes(field)) {
        updates[field] = { ...req.user[field], ...req.body[field] };
      } else {
        updates[field] = req.body[field];
      }
    }
  });

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: updates },
    { new: true, runValidators: true }
  ).select('-refreshTokens');

  return successResponse(res, { user }, 'Profile updated');
});

// @desc    Get user stats
// @route   GET /api/users/stats
const getUserStats = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('-refreshTokens');

  const stats = {
    xp: user.xp,
    level: user.level,
    currentStreak: user.currentStreak,
    longestStreak: user.longestStreak,
    totalStudyHours: user.totalStudyHours,
    badges: user.badges,
  };

  return successResponse(res, { stats }, 'Stats retrieved');
});

// @desc    Delete account
// @route   DELETE /api/users/account
const deleteAccount = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndDelete(req.user._id);
  if (!user) return errorResponse(res, 'User not found', 404);

  // In production, you'd also want to delete all associated data
  // For now, cascade delete can be handled via middleware or job

  return successResponse(res, {}, 'Account deleted successfully');
});

module.exports = { completeOnboarding, updateProfile, getUserStats, deleteAccount };
