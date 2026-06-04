const User = require('../models/User');
const bcrypt = require('bcryptjs');
const StudySession = require('../models/StudySession');
const Subject = require('../models/Subject');
const Topic = require('../models/Topic');
const Goal = require('../models/Goal');
const Exam = require('../models/Exam');
const Note = require('../models/Note');
const MockTest = require('../models/MockTest');
const DailyTask = require('../models/DailyTask');
const StudyPlan = require('../models/StudyPlan');
const RevisionItem = require('../models/RevisionItem');
const CalendarEvent = require('../models/CalendarEvent');
const Mistake = require('../models/Mistake');
const MotivationItem = require('../models/MotivationItem');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse, errorResponse } = require('../utils/response');
const { clearRefreshTokenCookie } = require('../utils/jwt');

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
  const allowedFields = ['name', 'bio', 'phone', 'timezone', 'avatar', 'preferences', 'theme', 'dashboardLayout', 'isPublicProfile', 'showOnLeaderboard', 'notificationSettings'];
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
  );

  return successResponse(res, { user: user.toPublicJSON() }, 'Profile updated');
});

// @desc    Get user stats
// @route   GET /api/users/stats
const getUserStats = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

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

// @desc    Change password while logged in
// @route   PUT /api/users/password
const changePassword = asyncHandler(async (req, res) => {
  const currentPassword = String(req.body.currentPassword || '');
  const newPassword = String(req.body.newPassword || '');

  if (!currentPassword || !newPassword) return errorResponse(res, 'Current and new password are required', 400);
  if (newPassword.length < 8) return errorResponse(res, 'New password must be at least 8 characters', 400);

  const user = await User.findById(req.user._id).select('+passwordHash');
  const isMatch = await bcrypt.compare(currentPassword, user.passwordHash || '');
  if (!isMatch) return errorResponse(res, 'Current password is incorrect', 401);

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.refreshTokens = [];
  await user.save();
  clearRefreshTokenCookie(res);

  return successResponse(res, {}, 'Password changed successfully');
});

// @desc    Export all user data
// @route   GET /api/users/export
const exportData = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const [user, sessions, subjects, topics, goals, exams, notes, mockTests, tasks, studyPlans, revisions, calendarEvents, mistakes, motivationItems] = await Promise.all([
    User.findById(userId),
    StudySession.find({ user: userId }).lean(),
    Subject.find({ user: userId }).lean(),
    Topic.find({ user: userId }).lean(),
    Goal.find({ user: userId }).lean(),
    Exam.find({ user: userId }).lean(),
    Note.find({ user: userId }).lean(),
    MockTest.find({ user: userId }).lean(),
    DailyTask.find({ user: userId }).lean(),
    StudyPlan.find({ user: userId }).lean(),
    RevisionItem.find({ user: userId }).lean(),
    CalendarEvent.find({ user: userId }).lean(),
    Mistake.find({ user: userId }).lean(),
    MotivationItem.find({ user: userId }).lean(),
  ]);

  return successResponse(res, {
    exportedAt: new Date().toISOString(),
    user: user.toPublicJSON(),
    sessions,
    subjects,
    topics,
    goals,
    exams,
    notes,
    mockTests,
    tasks,
    studyPlans,
    revisions,
    calendarEvents,
    mistakes,
    motivationItems,
  }, 'Data export generated');
});

// @desc    Delete account
// @route   DELETE /api/users/account
const deleteAccount = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndDelete(req.user._id);
  if (!user) return errorResponse(res, 'User not found', 404);

  // In production, you'd also want to delete all associated data
  // For now, cascade delete can be handled via middleware or job

  clearRefreshTokenCookie(res);
  return successResponse(res, {}, 'Account deleted successfully');
});

module.exports = { completeOnboarding, updateProfile, getUserStats, changePassword, exportData, deleteAccount };
