const mongoose = require('mongoose');

const ACHIEVEMENTS = [
  { id: 'first_session', title: 'First Step', description: 'Complete your first study session', xp: 50, icon: 'Star', category: 'milestone' },
  { id: 'hours_10', title: '10 Hour Scholar', description: 'Study for a total of 10 hours', xp: 100, icon: 'Clock', category: 'hours' },
  { id: 'hours_50', title: '50 Hour Champion', description: 'Study for a total of 50 hours', xp: 250, icon: 'Award', category: 'hours' },
  { id: 'hours_100', title: 'Century Scholar', description: 'Study for a total of 100 hours', xp: 500, icon: 'Trophy', category: 'hours' },
  { id: 'hours_500', title: '500 Hour Legend', description: 'Study for a total of 500 hours', xp: 1500, icon: 'Crown', category: 'hours' },
  { id: 'streak_3', title: '3 Day Streak', description: 'Study for 3 consecutive days', xp: 75, icon: 'Flame', category: 'streak' },
  { id: 'streak_7', title: 'Week Warrior', description: 'Study for 7 consecutive days', xp: 200, icon: 'Flame', category: 'streak' },
  { id: 'streak_30', title: 'Month Master', description: 'Study for 30 consecutive days', xp: 750, icon: 'Flame', category: 'streak' },
  { id: 'streak_100', title: 'Centurion', description: 'Study for 100 consecutive days', xp: 2000, icon: 'Flame', category: 'streak' },
  { id: 'topics_10', title: 'Topic Explorer', description: 'Complete 10 topics', xp: 150, icon: 'CheckCircle', category: 'topics' },
  { id: 'topics_50', title: 'Topic Master', description: 'Complete 50 topics', xp: 500, icon: 'CheckCircle', category: 'topics' },
  { id: 'goal_crusher', title: 'Goal Crusher', description: 'Complete 5 goals', xp: 300, icon: 'Target', category: 'goals' },
  { id: 'early_bird', title: 'Early Bird', description: 'Study before 7 AM', xp: 100, icon: 'Sunrise', category: 'habit' },
  { id: 'night_owl', title: 'Night Owl', description: 'Study after 10 PM', xp: 100, icon: 'Moon', category: 'habit' },
  { id: 'pomodoro_master', title: 'Pomodoro Master', description: 'Complete 50 pomodoro sessions', xp: 200, icon: 'Timer', category: 'focus' },
  { id: 'perfect_week', title: 'Perfect Week', description: 'Hit daily goal every day for a week', xp: 400, icon: 'Calendar', category: 'consistency' },
];

const userAchievementSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    achievementId: { type: String, required: true },
    unlockedAt: { type: Date, default: Date.now },
    xpEarned: { type: Number, required: true },
  },
  { timestamps: true }
);

userAchievementSchema.index({ user: 1, achievementId: 1 }, { unique: true });

module.exports = {
  UserAchievement: mongoose.model('UserAchievement', userAchievementSchema),
  ACHIEVEMENTS,
};
