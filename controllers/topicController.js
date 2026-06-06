const Topic = require('../models/Topic');
const Subject = require('../models/Subject');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse, errorResponse } = require('../utils/response');

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const updateSubjectProgress = async (subjectId, userId) => {
  const topics = await Topic.find({ subject: subjectId, user: userId, parentTopic: null });
  if (topics.length === 0) {
    await Subject.findByIdAndUpdate(subjectId, { completionPercentage: 0 });
    return;
  }
  const completed = topics.filter(t => t.isCompleted).length;
  const completionPercentage = Math.round((completed / topics.length) * 100);
  await Subject.findByIdAndUpdate(subjectId, { completionPercentage });
};

const getTopics = asyncHandler(async (req, res) => {
  const filter = { user: req.user._id };
  if (req.query.subjectId) filter.subject = req.query.subjectId;
  if (req.query.parentTopic) filter.parentTopic = req.query.parentTopic;
  else if (!req.query.all) filter.parentTopic = null;
  const topics = await Topic.find(filter).populate('subject', 'name color').sort({ order: 1, createdAt: -1 });
  return successResponse(res, { topics }, 'Topics retrieved');
});

const createTopic = asyncHandler(async (req, res) => {
  const { name, description, subjectId, parentTopic, priority, difficulty, estimatedHours, tags, resources } = req.body;
  const subject = await Subject.findOne({ _id: subjectId, user: req.user._id });
  if (!subject) return errorResponse(res, 'Subject not found', 404);
  const existing = await Topic.findOne({ user: req.user._id, subject: subjectId, name: new RegExp(`^${escapeRegex(String(name).trim())}$`, 'i') });
  if (existing) return errorResponse(res, 'A topic with this name already exists in this subject', 409);
  const topic = await Topic.create({ user: req.user._id, subject: subjectId, parentTopic: parentTopic || null, name, description, priority: priority || 'medium', difficulty: difficulty || 'medium', estimatedHours: estimatedHours || 0, tags: tags || [], resources: resources || [] });
  await updateSubjectProgress(subjectId, req.user._id);
  return successResponse(res, { topic }, 'Topic created', 201);
});

const updateTopic = asyncHandler(async (req, res) => {
  const allowedFields = ['name','description','isCompleted','priority','difficulty','estimatedHours','actualHours','confidenceLevel','tags','resources','notes','order'];
  const updates = {};
  allowedFields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
  if (updates.isCompleted === true) updates.completedAt = new Date();
  else if (updates.isCompleted === false) updates.completedAt = null;
  if (Object.keys(updates).length === 0) {
    return errorResponse(res, 'No valid topic fields provided for update', 400);
  }
  const topic = await Topic.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { $set: updates }, { new: true, runValidators: true });
  if (!topic) return errorResponse(res, 'Topic not found', 404);
  await updateSubjectProgress(topic.subject, req.user._id);
  return successResponse(res, { topic }, 'Topic updated');
});

const deleteTopic = asyncHandler(async (req, res) => {
  const topic = await Topic.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!topic) return errorResponse(res, 'Topic not found', 404);
  await Topic.deleteMany({ parentTopic: topic._id, user: req.user._id });
  await updateSubjectProgress(topic.subject, req.user._id);
  return successResponse(res, {}, 'Topic deleted');
});

const bulkUpdateTopics = asyncHandler(async (req, res) => {
  const { updates } = req.body;
  const results = await Promise.all(updates.map(({ id, ...data }) =>
    Topic.findOneAndUpdate({ _id: id, user: req.user._id }, { $set: data }, { new: true })
  ));
  return successResponse(res, { topics: results }, 'Topics updated');
});

module.exports = { getTopics, createTopic, updateTopic, deleteTopic, bulkUpdateTopics };
