const Mistake = require('../models/Mistake');
const Subject = require('../models/Subject');
const Topic = require('../models/Topic');
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
  if (!req.body.mistake?.trim()) return errorResponse(res, 'Mistake is required', 400);

  let subject = null;
  if (req.body.subject) {
    if (!mongoose.Types.ObjectId.isValid(req.body.subject)) return errorResponse(res, 'Subject not found', 404);
    subject = await Subject.findOne({ _id: req.body.subject, user: req.user._id });
    if (!subject) return errorResponse(res, 'Subject not found', 404);
  }

  let topic = null;
  const hasTopicId = mongoose.Types.ObjectId.isValid(req.body.topic);
  if (hasTopicId) {
    topic = await Topic.findOne({ _id: req.body.topic, user: req.user._id });
    if (!topic) return errorResponse(res, 'Topic not found', 404);
  }

  const mistake = await Mistake.create({
    user: req.user._id,
    subject: subject?._id || null,
    topic: topic?._id || null,
    topicText: hasTopicId ? '' : req.body.topic || '',
    mockTest: req.body.mockTest || null,
    question: req.body.question || '',
    mistake: req.body.mistake.trim(),
    reason: req.body.reason || 'other',
    fix: req.body.fix || '',
  });
  const populated = await Mistake.findById(mistake._id).populate('subject', 'name color').populate('topic', 'name');
  return successResponse(res, { mistake: populated }, 'Mistake saved', 201);
});

const updateMistake = asyncHandler(async (req, res) => {
  const allowed = ['question', 'mistake', 'reason', 'fix', 'isResolved', 'subject', 'topic', 'topicText'];
  const updates = {};
  allowed.forEach(field => { if (req.body[field] !== undefined) updates[field] = req.body[field]; });
  if (updates.isResolved === true) updates.resolvedAt = new Date();
  if (updates.isResolved === false) updates.resolvedAt = null;
  const mistake = await Mistake.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { $set: updates }, { new: true, runValidators: true })
    .populate('subject', 'name color')
    .populate('topic', 'name');
  if (!mistake) return errorResponse(res, 'Mistake not found', 404);
  return successResponse(res, { mistake }, 'Mistake updated');
});

const deleteMistake = asyncHandler(async (req, res) => {
  const mistake = await Mistake.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!mistake) return errorResponse(res, 'Mistake not found', 404);
  return successResponse(res, {}, 'Mistake deleted');
});

module.exports = { getMistakes, createMistake, updateMistake, deleteMistake };
