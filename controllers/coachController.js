const StudySession = require('../models/StudySession');
const Subject = require('../models/Subject');
const Topic = require('../models/Topic');
const Goal = require('../models/Goal');
const Exam = require('../models/Exam');
const DailyTask = require('../models/DailyTask');
const RevisionItem = require('../models/RevisionItem');
const Note = require('../models/Note');
const Mistake = require('../models/Mistake');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse, errorResponse } = require('../utils/response');

const todayKey = () => new Date().toISOString().split('T')[0];
const dateDaysAgo = days => new Date(Date.now() - days * 86400000);

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const updateSubjectProgress = async (subjectId, userId) => {
  const topics = await Topic.find({ subject: subjectId, user: userId, parentTopic: null });
  const completionPercentage = topics.length
    ? Math.round((topics.filter(topic => topic.isCompleted).length / topics.length) * 100)
    : 0;
  await Subject.findByIdAndUpdate(subjectId, { completionPercentage });
};

const getWeaknessReview = asyncHandler(async (req, res) => {
  const [topics, mistakes, subjects] = await Promise.all([
    Topic.find({ user: req.user._id, isCompleted: false }).populate('subject', 'name color'),
    Mistake.find({ user: req.user._id, isResolved: false }).populate('subject', 'name color').populate('topic', 'name'),
    Subject.find({ user: req.user._id, isArchived: false }),
  ]);

  const weakTopics = topics
    .map(topic => ({
      id: topic._id,
      title: topic.name,
      subject: topic.subject,
      score: (topic.difficulty === 'expert' ? 35 : topic.difficulty === 'hard' ? 25 : 10) +
        (topic.priority === 'critical' ? 35 : topic.priority === 'high' ? 25 : 10) +
        Math.max(0, 5 - (topic.confidenceLevel || 0)) * 8,
      reason: `${topic.difficulty} difficulty, ${topic.priority} priority, confidence ${topic.confidenceLevel || 0}/5`,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const subjectMistakes = mistakes.reduce((acc, mistake) => {
    const name = mistake.subject?.name || 'Unassigned';
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});

  const weakSubjects = subjects
    .map(subject => ({
      id: subject._id,
      name: subject.name,
      color: subject.color,
      completionPercentage: subject.completionPercentage || 0,
      issueCount: subjectMistakes[subject.name] || 0,
      score: (100 - (subject.completionPercentage || 0)) + (subjectMistakes[subject.name] || 0) * 15,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  return successResponse(res, { weakTopics, weakSubjects, openMistakes: mistakes.slice(0, 8) }, 'Weakness review generated');
});

const getSmartQueue = asyncHandler(async (req, res) => {
  const today = todayKey();
  const now = new Date();
  const [tasks, revisions, goals, topics, exams] = await Promise.all([
    DailyTask.find({ user: req.user._id, date: today, isCompleted: false }).limit(5),
    RevisionItem.find({ user: req.user._id }).populate('topic', 'name').populate('subject', 'name color'),
    Goal.find({ user: req.user._id, isActive: true, isCompleted: false }).sort({ endDate: 1 }).limit(3),
    Topic.find({ user: req.user._id, isCompleted: false }).populate('subject', 'name color').sort({ priority: -1, difficulty: -1 }).limit(5),
    Exam.find({ user: req.user._id, isActive: true }).sort({ examDate: 1 }).limit(2),
  ]);

  const dueRevisions = revisions.flatMap(revision => revision.schedule
    .filter(slot => new Date(slot.date) <= now && !slot.isCompleted)
    .map(slot => ({
      type: 'revision',
      title: `Revise ${revision.topic?.name || 'topic'}`,
      detail: `Day ${slot.intervalDays} revision`,
      priority: 95,
    })));

  const queue = [
    ...dueRevisions,
    ...tasks.map(task => ({ type: 'task', title: task.title, detail: `${task.priority} priority`, priority: task.priority === 'high' ? 90 : 70 })),
    ...exams.map(exam => ({ type: 'exam', title: `Prepare for ${exam.name}`, detail: `${Math.max(0, Math.ceil((new Date(exam.examDate) - Date.now()) / 86400000))} days left`, priority: 80 })),
    ...topics.map(topic => ({ type: 'topic', title: topic.name, detail: topic.subject?.name || 'Topic work', priority: topic.priority === 'critical' ? 85 : topic.priority === 'high' ? 75 : 55 })),
    ...goals.map(goal => ({ type: 'goal', title: goal.title, detail: `Due ${new Date(goal.endDate).toISOString().split('T')[0]}`, priority: 65 })),
  ].sort((a, b) => b.priority - a.priority).slice(0, 7);

  return successResponse(res, { queue }, 'Smart queue generated');
});

const getWeeklyReport = asyncHandler(async (req, res) => {
  const since = dateDaysAgo(7);
  const [sessions, completedTasks, mistakes, goals] = await Promise.all([
    StudySession.find({ user: req.user._id, isActive: false, startTime: { $gte: since } }).populate('subject', 'name color'),
    DailyTask.countDocuments({ user: req.user._id, isCompleted: true, completedAt: { $gte: since } }),
    Mistake.countDocuments({ user: req.user._id, createdAt: { $gte: since } }),
    Goal.find({ user: req.user._id, isCompleted: true, completedAt: { $gte: since } }),
  ]);

  const hours = sessions.reduce((sum, session) => sum + (session.duration || 0) / 3600, 0);
  const subjectHours = sessions.reduce((acc, session) => {
    const name = session.subject?.name || 'General';
    acc[name] = (acc[name] || 0) + (session.duration || 0) / 3600;
    return acc;
  }, {});
  const strongestSubject = Object.entries(subjectHours).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Not enough data';

  return successResponse(res, {
    hours: Number(hours.toFixed(2)),
    sessions: sessions.length,
    completedTasks,
    mistakesLogged: mistakes,
    goalsCompleted: goals.length,
    strongestSubject,
    recommendation: hours < 7 ? 'Keep the next week simple: one core topic and one revision daily.' : 'Good rhythm. Add mock-test mistake review to compound progress.',
  }, 'Weekly report generated');
});

const quickCapture = asyncHandler(async (req, res) => {
  const text = String(req.body.text || '').trim();
  if (!text) return errorResponse(res, 'Capture text is required', 400);
  const lower = text.toLowerCase();

  if (lower.startsWith('note:')) {
    const content = text.slice(5).trim();
    if (!content) return errorResponse(res, 'Note text is required after "note:"', 400);
    const note = await Note.create({ user: req.user._id, title: content.slice(0, 80) || 'Quick note', content, type: 'quick' });
    return successResponse(res, { type: 'note', item: note }, 'Quick note captured', 201);
  }

  if (lower.startsWith('mistake:')) {
    const mistakeText = text.slice(8).trim();
    if (!mistakeText) return errorResponse(res, 'Mistake text is required after "mistake:"', 400);
    const mistake = await Mistake.create({ user: req.user._id, mistake: mistakeText, reason: 'other' });
    return successResponse(res, { type: 'mistake', item: mistake }, 'Mistake captured', 201);
  }

  const taskTitle = lower.startsWith('task:') ? text.slice(5).trim() : text;
  if (!taskTitle) return errorResponse(res, 'Task title is required', 400);
  const task = await DailyTask.create({ user: req.user._id, title: taskTitle, date: todayKey(), priority: lower.includes('urgent') ? 'high' : 'medium' });
  return successResponse(res, { type: 'task', item: task }, 'Task captured', 201);
});

const importSyllabus = asyncHandler(async (req, res) => {
  const subject = await Subject.findOne({ _id: req.body.subjectId, user: req.user._id });
  if (!subject) return errorResponse(res, 'Subject not found', 404);
  const lines = [...new Set(String(req.body.text || req.body.syllabus || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean))];
  if (!lines.length) return errorResponse(res, 'Paste at least one topic', 400);

  const existing = await Topic.find({
    user: req.user._id,
    subject: subject._id,
    $or: lines.map(line => ({ name: new RegExp(`^${escapeRegex(line)}$`, 'i') })),
  }).select('name');
  const existingNames = new Set(existing.map(topic => topic.name.toLowerCase()));
  const docs = lines
    .filter(line => !existingNames.has(line.toLowerCase()))
    .map((name, index) => ({ user: req.user._id, subject: subject._id, name, order: index }));
  const topics = docs.length ? await Topic.insertMany(docs) : [];
  await updateSubjectProgress(subject._id, req.user._id);
  return successResponse(res, { created: topics.length, skipped: lines.length - topics.length, topics }, 'Syllabus imported');
});

module.exports = { getWeaknessReview, getSmartQueue, getWeeklyReport, quickCapture, importSyllabus };
