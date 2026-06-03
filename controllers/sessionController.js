const StudySession = require('../models/StudySession');
const Subject = require('../models/Subject');
const Topic = require('../models/Topic');
const User = require('../models/User');
const Goal = require('../models/Goal');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse, errorResponse } = require('../utils/response');
const { checkAndUnlockAchievements } = require('../services/achievementService');
const { notifyStudySessionCompleted, notifyStreakProgress, notifyGoalCompleted } = require('../services/notificationService');

const XP_PER_HOUR = 20;
const XP_PER_POMODORO = 10;

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
  if (lastStudy === today) { /* same day, no streak change */ }
  else if (lastStudy === yesterday) { user.currentStreak = (user.currentStreak || 0) + 1; }
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

const syncCompletedSessionGoals = async (userId) => {
  const activeGoals = await Goal.find({ user: userId, isActive: true, isCompleted: false, category: 'hours' });
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
    .sort({ startTime: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));
  return successResponse(res, { sessions, pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) } }, 'Sessions retrieved');
});

const startSession = asyncHandler(async (req, res) => {
  const existing = await StudySession.findOne({ user: req.user._id, isActive: true });
  if (existing) return errorResponse(res, 'A session is already active', 400);
  const { subjectId, topicId, examId, title, mode } = req.body;
  const session = await StudySession.create({
    user: req.user._id, subject: subjectId || null, topic: topicId || null, exam: examId || null,
    title: title || '', startTime: new Date(), isActive: true, mode: mode || 'standard',
  });
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
  if (req.body.pomodoroCount) session.pomodoroCount = req.body.pomodoroCount;
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
  const duration = Math.round((end - start) / 1000);
  const { xpEarned, streakInfo } = await updateUserStats(req.user._id, duration);
  const session = await StudySession.create({
    user: req.user._id, subject: subjectId || null, topic: topicId || null, exam: examId || null,
    title: title || '', startTime: start, endTime: end, duration, isActive: false, mode: 'manual',
    notes: notes || '', mood: mood || 'neutral', focusScore: focusScore || 5, productivityRating: productivityRating || 5, xpEarned,
  });
  if (subjectId) await Subject.findByIdAndUpdate(subjectId, { $inc: { totalStudyHours: duration / 3600 } });
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
    .populate('topic', 'name');
  return successResponse(res, { session: session || null }, 'Active session retrieved');
});

const deleteSession = asyncHandler(async (req, res) => {
  const session = await StudySession.findOneAndDelete({ _id: req.params.id, user: req.user._id, isActive: false });
  if (!session) return errorResponse(res, 'Session not found', 404);
  return successResponse(res, {}, 'Session deleted');
});

module.exports = { getSessions, startSession, pauseSession, resumeSession, stopSession, addManualSession, getActiveSession, deleteSession };
