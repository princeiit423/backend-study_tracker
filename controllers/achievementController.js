const { UserAchievement, ACHIEVEMENTS } = require('../models/Achievement');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/response');

const getAchievements = asyncHandler(async (req, res) => {
  const unlocked = await UserAchievement.find({ user: req.user._id });
  const unlockedIds = unlocked.map(a => a.achievementId);
  const achievements = ACHIEVEMENTS.map(a => ({ ...a, isUnlocked: unlockedIds.includes(a.id), unlockedAt: unlocked.find(u => u.achievementId === a.id)?.unlockedAt || null }));
  return successResponse(res, { achievements, totalUnlocked: unlockedIds.length, totalAvailable: ACHIEVEMENTS.length }, 'Achievements retrieved');
});

module.exports = { getAchievements };
