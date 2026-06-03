const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/response');

const getLeaderboard = asyncHandler(async (req, res) => {
  const { type = 'hours', period = 'all' } = req.query;
  let sortField = 'totalStudyHours';
  if (type === 'streak') sortField = 'currentStreak';
  if (type === 'xp') sortField = 'xp';
  const users = await User.find({ showOnLeaderboard: true }).select('name avatar totalStudyHours currentStreak longestStreak xp level').sort({ [sortField]: -1 }).limit(50);
  const ranked = users.map((u, i) => ({ rank: i + 1, name: u.name, avatar: u.avatar, totalStudyHours: Math.round(u.totalStudyHours || 0), currentStreak: u.currentStreak || 0, longestStreak: u.longestStreak || 0, xp: u.xp || 0, level: u.level || 1 }));
  const myRank = ranked.findIndex(u => u.name === req.user.name) + 1;
  return successResponse(res, { leaderboard: ranked, myRank }, 'Leaderboard retrieved');
});

module.exports = { getLeaderboard };
