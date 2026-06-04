const User = require('../models/User');
const StudySession = require('../models/StudySession');
const Subject = require('../models/Subject');
const Goal = require('../models/Goal');
const Exam = require('../models/Exam');
const Note = require('../models/Note');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/response');

const getAdminOverview = asyncHandler(async (req, res) => {
  const [users, sessions, subjects, goals, exams, notes, recentUsers] = await Promise.all([
    User.countDocuments(),
    StudySession.countDocuments({ isActive: false }),
    Subject.countDocuments(),
    Goal.countDocuments(),
    Exam.countDocuments(),
    Note.countDocuments(),
    User.find().sort({ createdAt: -1 }).limit(8).select('name email role level totalStudyHours createdAt'),
  ]);

  const totalHoursAgg = await StudySession.aggregate([
    { $match: { isActive: false } },
    { $group: { _id: null, seconds: { $sum: '$duration' } } },
  ]);

  return successResponse(res, {
    counts: { users, sessions, subjects, goals, exams, notes },
    totalStudyHours: Number(((totalHoursAgg[0]?.seconds || 0) / 3600).toFixed(2)),
    recentUsers,
  }, 'Admin overview retrieved');
});

const getAdminUsers = asyncHandler(async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 }).limit(100).select('name email role level xp totalStudyHours currentStreak createdAt');
  return successResponse(res, { users }, 'Users retrieved');
});

module.exports = { getAdminOverview, getAdminUsers };
