const User = require('../models/User');
const Goal = require('../models/Goal');
const StudySession = require('../models/StudySession');
const { createUniqueDailyNotification } = require('./notificationService');

const DEFAULT_TIMEZONE = 'Asia/Kolkata';

let reminderInterval = null;

const getLocalParts = (date, timezone = DEFAULT_TIMEZONE) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone || DEFAULT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  return parts.reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});
};

const getLocalDateKey = (date, timezone) => {
  const parts = getLocalParts(date, timezone);
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const getLocalTimeKey = (date, timezone) => {
  const parts = getLocalParts(date, timezone);
  return `${parts.hour}:${parts.minute}`;
};

const getYesterdayDateKey = (timezone) => {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return getLocalDateKey(yesterday, timezone);
};

const sendStudyReminder = async (user, todayKey, now) => {
  if (user.notificationSettings?.studyReminder === false) return;

  const studiedToday = await StudySession.exists({
    user: user._id,
    isActive: false,
    date: todayKey,
  });
  if (studiedToday) return;

  await createUniqueDailyNotification(user._id, {
    title: 'Time to study',
    message: `Your daily target is ${user.preferences?.dailyGoalHours || 4} hours. Start a session to keep momentum.`,
    type: 'reminder',
    actionUrl: '/dashboard',
    dedupeKey: `study-reminder-${todayKey}`,
  }, now);
};

const sendStreakReminder = async (user, todayKey, now) => {
  if (user.notificationSettings?.streakReminder === false || !user.lastStudyDate || !user.currentStreak) return;

  const timezone = user.timezone || DEFAULT_TIMEZONE;
  const lastStudyKey = getLocalDateKey(user.lastStudyDate, timezone);
  if (lastStudyKey !== getYesterdayDateKey(timezone)) return;

  const studiedToday = await StudySession.exists({
    user: user._id,
    isActive: false,
    date: todayKey,
  });
  if (studiedToday) return;

  await createUniqueDailyNotification(user._id, {
    title: 'Protect your streak',
    message: `Study today to keep your ${user.currentStreak} day streak alive.`,
    type: 'streak',
    actionUrl: '/dashboard',
    dedupeKey: `streak-risk-${todayKey}`,
  }, now);
};

const sendGoalReminders = async (user, todayKey, now) => {
  if (user.notificationSettings?.goalReminder === false) return;

  const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const goals = await Goal.find({
    user: user._id,
    isActive: true,
    isCompleted: false,
    endDate: { $lte: soon },
  }).limit(5);

  await Promise.all(goals.map(goal => createUniqueDailyNotification(user._id, {
    title: 'Goal needs attention',
    message: `"${goal.title}" is due soon. Progress: ${goal.currentValue}/${goal.targetValue} ${goal.unit}.`,
    type: 'goal',
    actionUrl: '/goals',
    dedupeKey: `goal-reminder-${goal._id}-${todayKey}`,
    metadata: { goalId: goal._id },
  }, now)));
};

const runReminderTick = async (now = new Date()) => {
  const users = await User.find({
    $or: [
      { 'notificationSettings.studyReminder': true },
      { 'notificationSettings.goalReminder': true },
      { 'notificationSettings.streakReminder': true },
    ],
  }).select('timezone preferences notificationSettings lastStudyDate currentStreak');

  await Promise.all(users.map(async (user) => {
    const timezone = user.timezone || DEFAULT_TIMEZONE;
    const reminderTime = user.notificationSettings?.reminderTime || '08:00';
    if (getLocalTimeKey(now, timezone) !== reminderTime) return;

    const todayKey = getLocalDateKey(now, timezone);
    await Promise.all([
      sendStudyReminder(user, todayKey, now),
      sendStreakReminder(user, todayKey, now),
      sendGoalReminders(user, todayKey, now),
    ]);
  }));
};

const startReminderService = () => {
  if (reminderInterval || process.env.DISABLE_REMINDER_SERVICE === 'true') return;

  reminderInterval = setInterval(() => {
    runReminderTick().catch(err => console.error('Reminder service failed:', err));
  }, 60 * 1000);
};

module.exports = { startReminderService, runReminderTick };
