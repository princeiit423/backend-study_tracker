const Notification = require('../models/Notification');
const User = require('../models/User');

const startOfDay = (date = new Date()) => {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
};

const getNotificationSetting = (type) => {
  switch (type) {
    case 'goal':
      return 'goalReminder';
    case 'streak':
      return 'streakReminder';
    case 'achievement':
      return 'achievementAlerts';
    case 'reminder':
      return 'studyReminder';
    default:
      return null;
  }
};

const createNotification = async (userId, payload) => {
  const user = await User.findById(userId).select('notificationSettings');
  if (!user) return null;

  const settingKey = payload.settingKey || getNotificationSetting(payload.type);
  if (settingKey && user.notificationSettings?.[settingKey] === false) return null;

  return Notification.create({
    user: userId,
    title: payload.title,
    message: payload.message,
    type: payload.type || 'system',
    actionUrl: payload.actionUrl || '',
    metadata: payload.metadata || {},
  });
};

const createUniqueDailyNotification = async (userId, payload, date = new Date()) => {
  const dedupeKey = payload.dedupeKey;
  if (!dedupeKey) return createNotification(userId, payload);

  const existing = await Notification.findOne({
    user: userId,
    'metadata.dedupeKey': dedupeKey,
    createdAt: { $gte: startOfDay(date) },
  });
  if (existing) return existing;

  return createNotification(userId, {
    ...payload,
    metadata: { ...(payload.metadata || {}), dedupeKey },
  });
};

const notifyStudySessionCompleted = async (userId, session, xpEarned) => {
  const minutes = Math.max(1, Math.round((session.duration || 0) / 60));
  return createNotification(userId, {
    title: 'Study session completed',
    message: `You studied for ${minutes} minute${minutes === 1 ? '' : 's'} and earned ${xpEarned} XP.`,
    type: 'reminder',
    actionUrl: '/sessions',
    metadata: { sessionId: session._id, duration: session.duration, xpEarned },
  });
};

const notifyStreakProgress = async (userId, streakInfo) => {
  if (!streakInfo?.changed || streakInfo.currentStreak < 2) return null;

  return createUniqueDailyNotification(userId, {
    title: 'Streak extended',
    message: `Nice work. Your study streak is now ${streakInfo.currentStreak} days.`,
    type: 'streak',
    actionUrl: '/dashboard',
    dedupeKey: `streak-${streakInfo.currentStreak}`,
    metadata: { currentStreak: streakInfo.currentStreak },
  });
};

const notifyGoalCompleted = async (goal) => createNotification(goal.user, {
  title: 'Goal completed',
  message: `You completed "${goal.title}".`,
  type: 'goal',
  actionUrl: '/goals',
  metadata: { goalId: goal._id, targetValue: goal.targetValue, unit: goal.unit },
});

module.exports = {
  createNotification,
  createUniqueDailyNotification,
  notifyStudySessionCompleted,
  notifyStreakProgress,
  notifyGoalCompleted,
};
