const RevisionItem = require('../models/RevisionItem');
const Topic = require('../models/Topic');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse, errorResponse } = require('../utils/response');

const INTERVALS = [1, 3, 7, 15];
const dateKey = (date) => date.toISOString().split('T')[0];

const getRevisions = asyncHandler(async (req, res) => {
  const revisions = await RevisionItem.find({ user: req.user._id })
    .populate('topic', 'name difficulty priority')
    .populate('subject', 'name color')
    .sort({ createdAt: -1 });
  return successResponse(res, { revisions }, 'Revisions retrieved');
});

const createRevision = asyncHandler(async (req, res) => {
  const topic = await Topic.findOne({ _id: req.body.topicId, user: req.user._id });
  if (!topic) return errorResponse(res, 'Topic not found', 404);
  const baseDate = req.body.baseDate ? new Date(req.body.baseDate) : new Date();

  const schedule = INTERVALS.map(intervalDays => {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + intervalDays);
    return { date: dateKey(date), intervalDays };
  });

  const revision = await RevisionItem.findOneAndUpdate(
    { user: req.user._id, topic: topic._id },
    { $set: { subject: topic.subject, baseDate, schedule } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).populate('topic', 'name difficulty priority').populate('subject', 'name color');

  return successResponse(res, { revision }, 'Revision schedule created', 201);
});

const updateRevisionSlot = asyncHandler(async (req, res) => {
  const revision = await RevisionItem.findOne({ _id: req.params.id, user: req.user._id });
  if (!revision) return errorResponse(res, 'Revision not found', 404);
  const slot = revision.schedule.id(req.params.slotId);
  if (!slot) return errorResponse(res, 'Revision slot not found', 404);
  if (req.body.isCompleted !== undefined) {
    slot.isCompleted = req.body.isCompleted;
    slot.completedAt = req.body.isCompleted ? new Date() : null;
  }
  await revision.save();
  return successResponse(res, { revision }, 'Revision updated');
});

const deleteRevision = asyncHandler(async (req, res) => {
  const revision = await RevisionItem.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!revision) return errorResponse(res, 'Revision not found', 404);
  return successResponse(res, {}, 'Revision deleted');
});

module.exports = { getRevisions, createRevision, updateRevisionSlot, deleteRevision };
