const Goal = require('../models/Goal');
const StudySession = require('../models/StudySession');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse, errorResponse } = require('../utils/response');
const { notifyGoalCompleted } = require('../services/notificationService');

const syncGoalProgress = async (goal) => {
  const wasCompleted = goal.isCompleted;
  if (goal.category === 'hours') {
    const sessions = await StudySession.find({ user: goal.user, isActive: false, startTime: { $gte: goal.startDate, $lte: goal.endDate } });
    const totalHours = sessions.reduce((acc, s) => acc + (s.duration / 3600), 0);
    goal.currentValue = parseFloat(totalHours.toFixed(2));
  }
  if (goal.currentValue >= goal.targetValue && !goal.isCompleted) {
    goal.isCompleted = true;
    goal.completedAt = new Date();
  }
  await goal.save();
  if (!wasCompleted && goal.isCompleted) await notifyGoalCompleted(goal);
  return goal;
};

const getGoals = asyncHandler(async (req, res) => {
  const filter = { user: req.user._id };
  if (req.query.type) filter.type = req.query.type;
  if (req.query.active === 'true') filter.isActive = true;
  const goals = await Goal.find(filter).populate('subject', 'name color').populate('exam', 'name').sort({ createdAt: -1 });
  return successResponse(res, { goals }, 'Goals retrieved');
});

const createGoal = asyncHandler(async (req, res) => {
  const { title, description, type, category, targetValue, unit, subject, exam, startDate, endDate, color, milestones } = req.body;
  const goal = await Goal.create({ user: req.user._id, title, description, type, category: category || 'hours', targetValue, unit: unit || 'hours', subject: subject || null, exam: exam || null, startDate: startDate || new Date(), endDate, color: color || '#3B82F6', milestones: milestones || [] });
  return successResponse(res, { goal }, 'Goal created', 201);
});

const updateGoal = asyncHandler(async (req, res) => {
  const allowedFields = ['title','description','targetValue','unit','endDate','color','isActive','milestones'];
  const updates = {};
  allowedFields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
  const goal = await Goal.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { $set: updates }, { new: true, runValidators: true });
  if (!goal) return errorResponse(res, 'Goal not found', 404);
  return successResponse(res, { goal }, 'Goal updated');
});

const deleteGoal = asyncHandler(async (req, res) => {
  const goal = await Goal.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!goal) return errorResponse(res, 'Goal not found', 404);
  return successResponse(res, {}, 'Goal deleted');
});

const syncGoals = asyncHandler(async (req, res) => {
  const activeGoals = await Goal.find({ user: req.user._id, isActive: true, isCompleted: false });
  const updated = await Promise.all(activeGoals.map(g => syncGoalProgress(g)));
  return successResponse(res, { goals: updated }, 'Goals synced');
});

module.exports = { getGoals, createGoal, updateGoal, deleteGoal, syncGoals };
