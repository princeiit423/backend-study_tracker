const StudySession = require('../models/StudySession');
const Exam = require('../models/Exam');
const Goal = require('../models/Goal');
const DailyTask = require('../models/DailyTask');
const RevisionItem = require('../models/RevisionItem');
const CalendarEvent = require('../models/CalendarEvent');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse, errorResponse } = require('../utils/response');

const toDateKey = (date) => new Date(date).toISOString().split('T')[0];

const getCalendarEvents = asyncHandler(async (req, res) => {
  const start = req.query.start ? new Date(req.query.start) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const end = req.query.end ? new Date(req.query.end) : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59);
  const startKey = toDateKey(start);
  const endKey = toDateKey(end);

  const [sessions, exams, goals, tasks, revisions, customEvents] = await Promise.all([
    StudySession.find({ user: req.user._id, isActive: false, startTime: { $gte: start, $lte: end } }).populate('subject', 'name color').lean(),
    Exam.find({ user: req.user._id, examDate: { $gte: start, $lte: end } }).lean(),
    Goal.find({ user: req.user._id, endDate: { $gte: start, $lte: end } }).lean(),
    DailyTask.find({ user: req.user._id, date: { $gte: startKey, $lte: endKey } }).lean(),
    RevisionItem.find({ user: req.user._id }).populate('topic', 'name').populate('subject', 'name color').lean(),
    CalendarEvent.find({ user: req.user._id, date: { $gte: startKey, $lte: endKey } }).lean(),
  ]);

  const events = [
    ...sessions.map(session => ({
      id: session._id,
      type: 'session',
      date: toDateKey(session.startTime),
      title: session.title || session.subject?.name || 'Study session',
      meta: `${Math.round((session.duration || 0) / 60)} min`,
      color: session.subject?.color || '#3B82F6',
    })),
    ...exams.map(exam => ({ id: exam._id, type: 'exam', date: toDateKey(exam.examDate), title: exam.name, meta: 'Exam day', color: exam.color || '#EF4444' })),
    ...goals.map(goal => ({ id: goal._id, type: 'goal', date: toDateKey(goal.endDate), title: goal.title, meta: 'Goal due', color: '#8B5CF6' })),
    ...tasks.map(task => ({ id: task._id, type: 'task', date: task.date, title: task.title, meta: task.isCompleted ? 'Done' : 'Task', color: task.isCompleted ? '#22C55E' : '#F59E0B' })),
    ...customEvents.map(event => ({ id: event._id, type: event.type, date: event.date, title: event.title, meta: event.notes || 'Important date', color: event.color || '#EC4899', editable: true })),
    ...revisions.flatMap(revision => revision.schedule
      .filter(slot => slot.date >= startKey && slot.date <= endKey)
      .map(slot => ({
        id: `${revision._id}-${slot._id}`,
        type: 'revision',
        date: slot.date,
        title: `Revise ${revision.topic?.name || 'topic'}`,
        meta: slot.isCompleted ? 'Done' : `Day ${slot.intervalDays}`,
        color: revision.subject?.color || '#06B6D4',
      }))),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return successResponse(res, { events }, 'Calendar events retrieved');
});

const createCalendarEvent = asyncHandler(async (req, res) => {
  const { title, date, type, color, notes } = req.body;
  if (!title || !date) return errorResponse(res, 'Title and date are required', 400);
  const event = await CalendarEvent.create({
    user: req.user._id,
    title,
    date,
    type: type || 'event',
    color: color || '#EC4899',
    notes: notes || '',
  });
  return successResponse(res, { event }, 'Calendar event created', 201);
});

const deleteCalendarEvent = asyncHandler(async (req, res) => {
  const event = await CalendarEvent.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!event) return errorResponse(res, 'Calendar event not found', 404);
  return successResponse(res, {}, 'Calendar event deleted');
});

module.exports = { getCalendarEvents, createCalendarEvent, deleteCalendarEvent };
