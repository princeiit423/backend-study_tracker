const Mistake = require('../models/Mistake');
const mongoose = require('mongoose');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse, errorResponse } = require('../utils/response');

const getMistakes = asyncHandler(async (req, res) => {
  const filter = { user: req.user._id };
  if (req.query.resolved !== undefined) filter.isResolved = req.query.resolved === 'true';
  if (req.query.status === 'open') filter.isResolved = false;
  if (req.query.subjectId) filter.subject = req.query.subjectId;
  const mistakes = await Mistake.find(filter)
    .populate('subject', 'name color')
    .populate('topic', 'name')
    .sort({ isResolved: 1, createdAt: -1 });
  return successResponse(res, { mistakes }, 'Mistakes retrieved');
});

const createMistake = asyncHandler(async (req, res) => {
  const hasTopicId = mongoose.Types.ObjectId.isValid(req.body.topic);
  const mistake = await Mistake.create({
    user: req.user._id,
    subject: req.body.subject || null,
    topic: hasTopicId ? req.body.topic : null,
    topicText: hasTopicId ? '' : req.body.topic || '',
    mockTest: req.body.mockTest || null,
    question: req.body.question || '',
    mistake: req.body.mistake,
    reason: req.body.reason || 'other',
    fix: req.body.fix || '',
  });
  return successResponse(res, { mistake }, 'Mistake saved', 201);
});

const updateMistake = asyncHandler(async (req, res) => {
  const allowed = ['question', 'mistake', 'reason', 'fix', 'isResolved', 'subject', 'topic', 'topicText'];
  const updates = {};
  allowed.forEach(field => { if (req.body[field] !== undefined) updates[field] = req.body[field]; });
  if (updates.isResolved === true) updates.resolvedAt = new Date();
  if (updates.isResolved === false) updates.resolvedAt = null;
  const mistake = await Mistake.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { $set: updates }, { new: true });
  if (!mistake) return errorResponse(res, 'Mistake not found', 404);
  return successResponse(res, { mistake }, 'Mistake updated');
});

const deleteMistake = asyncHandler(async (req, res) => {
  const mistake = await Mistake.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!mistake) return errorResponse(res, 'Mistake not found', 404);
  return successResponse(res, {}, 'Mistake deleted');
});

module.exports = { getMistakes, createMistake, updateMistake, deleteMistake };
