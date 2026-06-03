const StudySession = require('../models/StudySession');
const Subject = require('../models/Subject');
const Goal = require('../models/Goal');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/response');

const getDashboardStats = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart); weekStart.setDate(todayStart.getDate() - todayStart.getDay());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const [todaySessions, weekSessions, monthSessions, yearSessions, allSessions] = await Promise.all([
    StudySession.find({ user: userId, isActive: false, startTime: { $gte: todayStart } }),
    StudySession.find({ user: userId, isActive: false, startTime: { $gte: weekStart } }),
    StudySession.find({ user: userId, isActive: false, startTime: { $gte: monthStart } }),
    StudySession.find({ user: userId, isActive: false, startTime: { $gte: yearStart } }),
    StudySession.find({ user: userId, isActive: false }),
  ]);

  const calcHours = (sessions) => sessions.reduce((acc, s) => acc + (s.duration / 3600), 0);
  const user = await User.findById(userId).select('currentStreak longestStreak xp level totalStudyHours preferences');

  const todayGoalHours = user.preferences?.dailyGoalHours || 4;
  const weekGoalHours = user.preferences?.weeklyGoalHours || 28;

  const stats = {
    today: { hours: parseFloat(calcHours(todaySessions).toFixed(2)), sessions: todaySessions.length, goal: todayGoalHours, progress: Math.min(100, Math.round((calcHours(todaySessions) / todayGoalHours) * 100)) },
    week: { hours: parseFloat(calcHours(weekSessions).toFixed(2)), sessions: weekSessions.length, goal: weekGoalHours, progress: Math.min(100, Math.round((calcHours(weekSessions) / weekGoalHours) * 100)) },
    month: { hours: parseFloat(calcHours(monthSessions).toFixed(2)), sessions: monthSessions.length },
    year: { hours: parseFloat(calcHours(yearSessions).toFixed(2)), sessions: yearSessions.length },
    total: { hours: parseFloat(user.totalStudyHours?.toFixed(2) || '0'), sessions: allSessions.length },
    streak: { current: user.currentStreak || 0, longest: user.longestStreak || 0 },
    gamification: { xp: user.xp || 0, level: user.level || 1 },
  };
  return successResponse(res, { stats }, 'Dashboard stats retrieved');
});

const getHeatmap = asyncHandler(async (req, res) => {
  const { year } = req.query;
  const targetYear = parseInt(year) || new Date().getFullYear();
  const startDate = new Date(targetYear, 0, 1);
  const endDate = new Date(targetYear, 11, 31, 23, 59, 59);

  const sessions = await StudySession.find({ user: req.user._id, isActive: false, startTime: { $gte: startDate, $lte: endDate } });
  const heatmapData = {};
  sessions.forEach(s => {
    const dateKey = s.date || s.startTime.toISOString().split('T')[0];
    heatmapData[dateKey] = (heatmapData[dateKey] || 0) + (s.duration / 3600);
  });
  const result = Object.entries(heatmapData).map(([date, hours]) => ({ date, hours: parseFloat(hours.toFixed(2)), count: 1 }));
  return successResponse(res, { heatmap: result, year: targetYear }, 'Heatmap data retrieved');
});

const getSubjectDistribution = asyncHandler(async (req, res) => {
  const { period = '30' } = req.query;
  const daysAgo = new Date(Date.now() - parseInt(period) * 24 * 60 * 60 * 1000);
  const sessions = await StudySession.find({ user: req.user._id, isActive: false, startTime: { $gte: daysAgo }, subject: { $ne: null } }).populate('subject', 'name color');
  const subjectMap = {};
  sessions.forEach(s => {
    if (!s.subject) return;
    const id = s.subject._id.toString();
    if (!subjectMap[id]) subjectMap[id] = { id, name: s.subject.name, color: s.subject.color, hours: 0, sessions: 0 };
    subjectMap[id].hours += s.duration / 3600;
    subjectMap[id].sessions += 1;
  });
  const distribution = Object.values(subjectMap).map(s => ({ ...s, hours: parseFloat(s.hours.toFixed(2)) })).sort((a, b) => b.hours - a.hours);
  return successResponse(res, { distribution }, 'Subject distribution retrieved');
});

const getWeeklyChart = asyncHandler(async (req, res) => {
  const weeks = parseInt(req.query.weeks) || 12;
  const startDate = new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000);
  const sessions = await StudySession.find({ user: req.user._id, isActive: false, startTime: { $gte: startDate } });
  const weekMap = {};
  sessions.forEach(s => {
    const d = new Date(s.startTime);
    const weekStart = new Date(d); weekStart.setDate(d.getDate() - d.getDay());
    const key = weekStart.toISOString().split('T')[0];
    weekMap[key] = (weekMap[key] || 0) + (s.duration / 3600);
  });
  const chart = Object.entries(weekMap).map(([week, hours]) => ({ week, hours: parseFloat(hours.toFixed(2)) })).sort((a, b) => a.week.localeCompare(b.week));
  return successResponse(res, { chart }, 'Weekly chart retrieved');
});

const getDailyChart = asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const sessions = await StudySession.find({ user: req.user._id, isActive: false, startTime: { $gte: startDate } });
  const dayMap = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
    dayMap[d] = 0;
  }
  sessions.forEach(s => {
    const key = s.date || s.startTime.toISOString().split('T')[0];
    if (dayMap[key] !== undefined) dayMap[key] += s.duration / 3600;
  });
  const chart = Object.entries(dayMap).map(([date, hours]) => ({ date, hours: parseFloat(hours.toFixed(2)) })).sort((a, b) => a.date.localeCompare(b.date));
  return successResponse(res, { chart }, 'Daily chart retrieved');
});

const getProductivityInsights = asyncHandler(async (req, res) => {
  const sessions = await StudySession.find({ user: req.user._id, isActive: false, startTime: { $gte: new Date(Date.now() - 90 * 86400000) } });
  const dayOfWeekMap = Array(7).fill(0).map((_, i) => ({ day: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][i], hours: 0, count: 0 }));
  const hourOfDayMap = Array(24).fill(0).map((_, i) => ({ hour: i, hours: 0, count: 0 }));
  sessions.forEach(s => {
    const d = new Date(s.startTime);
    dayOfWeekMap[d.getDay()].hours += s.duration / 3600;
    dayOfWeekMap[d.getDay()].count += 1;
    hourOfDayMap[d.getHours()].hours += s.duration / 3600;
    hourOfDayMap[d.getHours()].count += 1;
  });
  const mostProductiveDay = dayOfWeekMap.sort((a, b) => b.hours - a.hours)[0];
  const mostProductiveHour = hourOfDayMap.sort((a, b) => b.hours - a.hours)[0];
  const avgFocusScore = sessions.length > 0 ? sessions.reduce((a, s) => a + (s.focusScore || 5), 0) / sessions.length : 0;
  const avgSessionLength = sessions.length > 0 ? sessions.reduce((a, s) => a + s.duration, 0) / sessions.length / 60 : 0;
  return successResponse(res, { mostProductiveDay, mostProductiveHour, avgFocusScore: parseFloat(avgFocusScore.toFixed(1)), avgSessionLengthMinutes: Math.round(avgSessionLength), totalSessions: sessions.length }, 'Productivity insights retrieved');
});

module.exports = { getDashboardStats, getHeatmap, getSubjectDistribution, getWeeklyChart, getDailyChart, getProductivityInsights };
