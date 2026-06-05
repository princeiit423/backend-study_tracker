const StudySession = require('../models/StudySession');
const Subject = require('../models/Subject');
const Topic = require('../models/Topic');
const Exam = require('../models/Exam');
const User = require('../models/User');
const Goal = require('../models/Goal');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse, errorResponse } = require('../utils/response');
const { checkAndUnlockAchievements } = require('../services/achievementService');
const { notifyStudySessionCompleted, notifyStreakProgress, notifyGoalCompleted } = require('../services/notificationService');

const XP_PER_HOUR = 20;
const XP_PER_POMODORO = 10;
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const isProtectedRestGap = (lastStudyDate, todayDate, restDays = []) => {
  if (!lastStudyDate) return false;
  let cursor = addDays(lastStudyDate, 1);
  const end = new Date(todayDate);
  end.setHours(0, 0, 0, 0);
  cursor.setHours(0, 0, 0, 0);
  if (cursor >= end) return false;
  while (cursor < end) {
    if (!restDays.includes(DAY_NAMES[cursor.getDay()])) return false;
    cursor = addDays(cursor, 1);
  }
  return true;
};

const getDateKey = (date) => new Date(date).toISOString().split('T')[0];

const toDateStart = (dateKey) => {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const isConsecutiveStudyDate = (previousKey, currentKey, restDays = []) => {
  const previousDate = toDateStart(previousKey);
  const currentDate = toDateStart(currentKey);
  if ((currentDate - previousDate) / 86400000 === 1) return true;
  return isProtectedRestGap(previousDate, currentDate, restDays);
};

const calculateQualityScore = ({ duration, focusScore, productivityRating, distractions = 0, reflection = {} }) => {
  const focusPart = (Number(focusScore) || 5) * 4;
  const productivityPart = (Number(productivityRating) || 5) * 4;
  const durationPart = Math.min(20, Math.round((duration || 0) / 1800) * 5);
  const reflectionPart = reflection.completed || reflection.nextAction ? 10 : 0;
  const distractionPenalty = Math.min(20, Number(distractions) * 3 || 0);
  return Math.max(0, Math.min(100, focusPart + productivityPart + durationPart + reflectionPart - distractionPenalty));
};

const updateUserStats = async (userId, durationSeconds) => {
  const hours = durationSeconds / 3600;
  const xpEarned = Math.round(hours * XP_PER_HOUR);
  const user = await User.findById(userId);
  const previousStreak = user.currentStreak || 0;
  user.totalStudyHours = (user.totalStudyHours || 0) + hours;
  user.xp = (user.xp || 0) + xpEarned;
  const today = new Date().toISOString().split('T')[0];
  const lastStudy = user.lastStudyDate ? user.lastStudyDate.toISOString().split('T')[0] : null;
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const protectedRestGap = isProtectedRestGap(user.lastStudyDate, new Date(), user.preferences?.restDays || []);
  if (lastStudy === today) { /* same day, no streak change */ }
  else if (lastStudy === yesterday) { user.currentStreak = (user.currentStreak || 0) + 1; }
  else if (protectedRestGap) { user.currentStreak = (user.currentStreak || 0) + 1; }
  else { user.currentStreak = 1; }
  if (user.currentStreak > (user.longestStreak || 0)) user.longestStreak = user.currentStreak;
  user.lastStudyDate = new Date();
  user.level = user.calculateLevel();
  await user.save();
  return {
    xpEarned,
    streakInfo: {
      changed: user.currentStreak !== previousStreak,
      previousStreak,
      currentStreak: user.currentStreak || 0,
    },
  };
};

const recomputeUserStreaks = async (userId) => {
  const user = await User.findById(userId);
  if (!user) return;

  const sessions = await StudySession.find({ user: userId, isActive: false })
    .select('startTime date')
    .sort({ startTime: 1 });
  const dateKeys = [...new Set(sessions.map(session => session.date || getDateKey(session.startTime)))];

  if (dateKeys.length === 0) {
    user.currentStreak = 0;
    user.longestStreak = 0;
    user.lastStudyDate = null;
    await user.save();
    return;
  }

  let run = 0;
  let longest = 0;
  let previousKey = null;
  const restDays = user.preferences?.restDays || [];

  for (const dateKey of dateKeys) {
    run = previousKey && isConsecutiveStudyDate(previousKey, dateKey, restDays) ? run + 1 : 1;
    longest = Math.max(longest, run);
    previousKey = dateKey;
  }

  const latestKey = dateKeys[dateKeys.length - 1];
  const today = new Date();
  const todayKey = getDateKey(today);
  const yesterdayKey = getDateKey(Date.now() - 86400000);
  const latestDate = toDateStart(latestKey);
  const currentStreakIsLive = latestKey === todayKey || latestKey === yesterdayKey || isProtectedRestGap(latestDate, today, restDays);

  user.currentStreak = currentStreakIsLive ? run : 0;
  user.longestStreak = longest;
  user.lastStudyDate = latestDate;
  await user.save();
};

const reverseSessionStats = async (session) => {
  const hours = (session.duration || 0) / 3600;
  const xpEarned = session.xpEarned || Math.round(hours * XP_PER_HOUR);
  const user = await User.findById(session.user);

  if (user) {
    user.totalStudyHours = Math.max(0, (user.totalStudyHours || 0) - hours);
    user.xp = Math.max(0, (user.xp || 0) - xpEarned);
    user.level = user.calculateLevel();
    await user.save();
  }

  const updates = [];
  if (session.subject) {
    updates.push(Subject.findByIdAndUpdate(session.subject, { $inc: { totalStudyHours: -hours } }));
  }
  if (session.topic) {
    updates.push(Topic.findByIdAndUpdate(session.topic, { $inc: { actualHours: -hours } }));
  }

  await Promise.all(updates);
};

const syncCompletedSessionGoals = async (userId) => {
  const activeGoals = await Goal.find({ user: userId, isActive: true, category: 'hours' });
  const completedGoals = [];

  for (const goal of activeGoals) {
    const sessions = await StudySession.find({
      user: goal.user,
      isActive: false,
      startTime: { $gte: goal.startDate, $lte: goal.endDate },
    });
    const totalHours = sessions.reduce((acc, s) => acc + (s.duration / 3600), 0);
    goal.currentValue = parseFloat(totalHours.toFixed(2));

    if (goal.currentValue >= goal.targetValue && !goal.isCompleted) {
      goal.isCompleted = true;
      goal.completedAt = new Date();
      completedGoals.push(goal);
    } else if (goal.currentValue < goal.targetValue && goal.isCompleted) {
      goal.isCompleted = false;
      goal.completedAt = null;
    }

    await goal.save();
  }

  await Promise.all(completedGoals.map(goal => notifyGoalCompleted(goal)));
  return completedGoals;
};

const getSessions = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, subjectId, startDate, endDate, mode } = req.query;
  const filter = { user: req.user._id, isActive: false };
  if (subjectId) filter.subject = subjectId;
  if (mode) filter.mode = mode;
  if (startDate || endDate) {
    filter.startTime = {};
    if (startDate) filter.startTime.$gte = new Date(startDate);
    if (endDate) filter.startTime.$lte = new Date(endDate);
  }
  const total = await StudySession.countDocuments(filter);
  const sessions = await StudySession.find(filter)
    .populate('subject', 'name color icon')
    .populate('topic', 'name')
    .populate('exam', 'name color')
    .sort({ startTime: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));
  return successResponse(res, { sessions, pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) } }, 'Sessions retrieved');
});

const startSession = asyncHandler(async (req, res) => {
  const existing = await StudySession.findOne({ user: req.user._id, isActive: true });
  if (existing) return errorResponse(res, 'A session is already active', 400);
  const { subjectId, topicId, examId, title, mode } = req.body;
  if (subjectId) {
    const subject = await Subject.findOne({ _id: subjectId, user: req.user._id });
    if (!subject) return errorResponse(res, 'Subject not found', 404);
  }
  if (topicId) {
    const topic = await Topic.findOne({ _id: topicId, user: req.user._id, ...(subjectId ? { subject: subjectId } : {}) });
    if (!topic) return errorResponse(res, 'Topic not found', 404);
  }
  if (examId) {
    const exam = await Exam.findOne({ _id: examId, user: req.user._id });
    if (!exam) return errorResponse(res, 'Exam not found', 404);
  }
  const session = await StudySession.create({
    user: req.user._id, subject: subjectId || null, topic: topicId || null, exam: examId || null,
    title: title || '', startTime: new Date(), isActive: true, mode: mode || 'standard',
  });
  await session.populate([
    { path: 'subject', select: 'name color icon' },
    { path: 'topic', select: 'name' },
    { path: 'exam', select: 'name color' },
  ]);
  return successResponse(res, { session }, 'Session started', 201);
});

const pauseSession = asyncHandler(async (req, res) => {
  const session = await StudySession.findOne({ _id: req.params.id, user: req.user._id, isActive: true });
  if (!session) return errorResponse(res, 'Active session not found', 404);
  session.isPaused = true;
  session.pausedAt = new Date();
  await session.save();
  return successResponse(res, { session }, 'Session paused');
});

const resumeSession = asyncHandler(async (req, res) => {
  const session = await StudySession.findOne({ _id: req.params.id, user: req.user._id, isActive: true, isPaused: true });
  if (!session) return errorResponse(res, 'Paused session not found', 404);
  const pausedDuration = (new Date() - session.pausedAt) / 1000;
  session.totalPausedTime = (session.totalPausedTime || 0) + pausedDuration;
  session.isPaused = false;
  session.pausedAt = null;
  await session.save();
  return successResponse(res, { session }, 'Session resumed');
});

const stopSession = asyncHandler(async (req, res) => {
  const session = await StudySession.findOne({ _id: req.params.id, user: req.user._id, isActive: true });
  if (!session) return errorResponse(res, 'Active session not found', 404);
  const endTime = new Date();
  const totalElapsed = (endTime - session.startTime) / 1000;
  const duration = Math.max(0, totalElapsed - (session.totalPausedTime || 0));
  session.endTime = endTime;
  session.duration = Math.round(duration);
  session.isActive = false;
  session.isPaused = false;
  if (req.body.notes) session.notes = req.body.notes;
  if (req.body.mood) session.mood = req.body.mood;
  if (req.body.focusScore) session.focusScore = req.body.focusScore;
  if (req.body.productivityRating) session.productivityRating = req.body.productivityRating;
  if (req.body.reflection) {
    session.reflection = {
      completed: req.body.reflection.completed || '',
      blockers: req.body.reflection.blockers || '',
      nextAction: req.body.reflection.nextAction || '',
      distractions: Math.max(0, Number(req.body.reflection.distractions) || 0),
    };
  }
  if (req.body.pomodoroCount) session.pomodoroCount = req.body.pomodoroCount;
  session.qualityScore = calculateQualityScore({
    duration: session.duration,
    focusScore: session.focusScore,
    productivityRating: session.productivityRating,
    distractions: session.reflection?.distractions || 0,
    reflection: session.reflection || {},
  });
  const { xpEarned, streakInfo } = await updateUserStats(req.user._id, session.duration);
  session.xpEarned = xpEarned;
  await session.save();
  if (session.subject) await Subject.findByIdAndUpdate(session.subject, { $inc: { totalStudyHours: session.duration / 3600 } });
  if (session.topic) await Topic.findByIdAndUpdate(session.topic, { $inc: { actualHours: session.duration / 3600 } });
  await Promise.all([
    notifyStudySessionCompleted(req.user._id, session, xpEarned),
    notifyStreakProgress(req.user._id, streakInfo),
    syncCompletedSessionGoals(req.user._id),
    checkAndUnlockAchievements(req.user._id),
  ]);
  return successResponse(res, { session, xpEarned }, 'Session completed');
});

const addManualSession = asyncHandler(async (req, res) => {
  const { subjectId, topicId, examId, title, startTime, endTime, notes, mood, focusScore, productivityRating } = req.body;
  const start = new Date(startTime);
  const end = new Date(endTime);
  if (end <= start) return errorResponse(res, 'End time must be after start time', 400);
  if (subjectId) {
    const subject = await Subject.findOne({ _id: subjectId, user: req.user._id });
    if (!subject) return errorResponse(res, 'Subject not found', 404);
  }
  if (topicId) {
    const topic = await Topic.findOne({ _id: topicId, user: req.user._id, ...(subjectId ? { subject: subjectId } : {}) });
    if (!topic) return errorResponse(res, 'Topic not found', 404);
  }
  if (examId) {
    const exam = await Exam.findOne({ _id: examId, user: req.user._id });
    if (!exam) return errorResponse(res, 'Exam not found', 404);
  }
  const duration = Math.round((end - start) / 1000);
  const { xpEarned, streakInfo } = await updateUserStats(req.user._id, duration);
  const session = await StudySession.create({
    user: req.user._id, subject: subjectId || null, topic: topicId || null, exam: examId || null,
    title: title || '', startTime: start, endTime: end, duration, isActive: false, mode: 'manual',
    notes: notes || '', mood: mood || 'neutral', focusScore: focusScore || 5, productivityRating: productivityRating || 5,
    qualityScore: calculateQualityScore({ duration, focusScore: focusScore || 5, productivityRating: productivityRating || 5 }),
    xpEarned,
  });
  if (subjectId) await Subject.findByIdAndUpdate(subjectId, { $inc: { totalStudyHours: duration / 3600 } });
  if (topicId) await Topic.findByIdAndUpdate(topicId, { $inc: { actualHours: duration / 3600 } });
  await Promise.all([
    notifyStudySessionCompleted(req.user._id, session, xpEarned),
    notifyStreakProgress(req.user._id, streakInfo),
    syncCompletedSessionGoals(req.user._id),
    checkAndUnlockAchievements(req.user._id),
  ]);
  return successResponse(res, { session }, 'Manual session added', 201);
});

const getActiveSession = asyncHandler(async (req, res) => {
  const session = await StudySession.findOne({ user: req.user._id, isActive: true })
    .populate('subject', 'name color icon')
    .populate('topic', 'name')
    .populate('exam', 'name color');
  return successResponse(res, { session: session || null }, 'Active session retrieved');
});

const deleteSession = asyncHandler(async (req, res) => {
  const session = await StudySession.findOne({ _id: req.params.id, user: req.user._id, isActive: false });
  if (!session) return errorResponse(res, 'Session not found', 404);
  await reverseSessionStats(session);
  await session.deleteOne();
  await recomputeUserStreaks(req.user._id);
  await syncCompletedSessionGoals(req.user._id);
  return successResponse(res, {}, 'Session deleted');
});

module.exports = { getSessions, startSession, pauseSession, resumeSession, stopSession, addManualSession, getActiveSession, deleteSession };
