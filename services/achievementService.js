const { UserAchievement, ACHIEVEMENTS } = require('../models/Achievement');
const User = require('../models/User');
const { createNotification } = require('./notificationService');

const checkAndUnlockAchievements = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) return [];

    const unlocked = await UserAchievement.find({ user: userId });
    const unlockedIds = new Set(unlocked.map(a => a.achievementId));
    const newUnlocks = [];

    for (const achievement of ACHIEVEMENTS) {
      if (unlockedIds.has(achievement.id)) continue;

      let shouldUnlock = false;

      switch (achievement.id) {
        case 'hours_10': shouldUnlock = user.totalStudyHours >= 10; break;
        case 'hours_50': shouldUnlock = user.totalStudyHours >= 50; break;
        case 'hours_100': shouldUnlock = user.totalStudyHours >= 100; break;
        case 'hours_500': shouldUnlock = user.totalStudyHours >= 500; break;
        case 'streak_3': shouldUnlock = user.currentStreak >= 3; break;
        case 'streak_7': shouldUnlock = user.currentStreak >= 7; break;
        case 'streak_30': shouldUnlock = user.currentStreak >= 30; break;
        case 'streak_100': shouldUnlock = user.currentStreak >= 100; break;
        default: shouldUnlock = false;
      }

      if (shouldUnlock) {
        await UserAchievement.create({ user: userId, achievementId: achievement.id, xpEarned: achievement.xp });
        user.xp = (user.xp || 0) + achievement.xp;
        user.badges = [...(user.badges || []), achievement.id];
        newUnlocks.push(achievement);

        await createNotification(userId, {
          title: 'Achievement Unlocked!',
          message: `You earned "${achievement.title}" - ${achievement.description}`,
          type: 'achievement',
          actionUrl: '/achievements',
          metadata: { achievementId: achievement.id, xp: achievement.xp },
        });
      }
    }

    if (newUnlocks.length > 0) {
      user.level = user.calculateLevel();
      await user.save();
    }

    return newUnlocks;
  } catch (err) {
    console.error('Achievement check failed:', err);
    return [];
  }
};

module.exports = { checkAndUnlockAchievements };
