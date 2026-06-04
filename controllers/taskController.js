const DailyTask = require('../models/DailyTask');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse, errorResponse } = require('../utils/response');

const todayKey = () => new Date().toISOString().split('T')[0];

const getTasks = asyncHandler(async (req, res) => {
  const filter = { user: req.user._id };
  if (req.query.date) filter.date = req.query.date;
  if (req.query.completed !== undefined) filter.isCompleted = req.query.completed === 'true';
  const tasks = await DailyTask.find(filter)
    .populate('subject', 'name color')
    .populate('topic', 'name')
    .populate('goal', 'title')
    .sort({ isCompleted: 1, priority: -1, createdAt: -1 });
  return successResponse(res, { tasks }, 'Tasks retrieved');
});

const createTask = asyncHandler(async (req, res) => {
  const task = await DailyTask.create({
    user: req.user._id,
    title: req.body.title,
    date: req.body.date || todayKey(),
    subject: req.body.subject || null,
    topic: req.body.topic || null,
    goal: req.body.goal || null,
    priority: req.body.priority || 'medium',
  });
  return successResponse(res, { task }, 'Task created', 201);
});

const updateTask = asyncHandler(async (req, res) => {
  const allowed = ['title', 'date', 'subject', 'topic', 'goal', 'priority', 'isCompleted'];
  const updates = {};
  allowed.forEach((field) => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });
  if (updates.isCompleted === true) updates.completedAt = new Date();
  if (updates.isCompleted === false) updates.completedAt = null;

  const task = await DailyTask.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { $set: updates }, { new: true });
  if (!task) return errorResponse(res, 'Task not found', 404);
  return successResponse(res, { task }, 'Task updated');
});

const deleteTask = asyncHandler(async (req, res) => {
  const task = await DailyTask.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!task) return errorResponse(res, 'Task not found', 404);
  return successResponse(res, {}, 'Task deleted');
});

module.exports = { getTasks, createTask, updateTask, deleteTask };
