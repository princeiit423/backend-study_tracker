const MotivationItem = require('../models/MotivationItem');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse, errorResponse } = require('../utils/response');

const getMotivation = asyncHandler(async (req, res) => {
  const items = await MotivationItem.find({ user: req.user._id }).sort({ isPinned: -1, createdAt: -1 });
  return successResponse(res, { items }, 'Motivation items retrieved');
});

const createMotivation = asyncHandler(async (req, res) => {
  const item = await MotivationItem.create({
    user: req.user._id,
    title: req.body.title,
    body: req.body.body || '',
    type: req.body.type || 'reason',
    isPinned: !!req.body.isPinned,
  });
  return successResponse(res, { item }, 'Motivation item created', 201);
});

const updateMotivation = asyncHandler(async (req, res) => {
  const allowed = ['title', 'body', 'type', 'isPinned'];
  const updates = {};
  allowed.forEach(field => { if (req.body[field] !== undefined) updates[field] = req.body[field]; });
  const item = await MotivationItem.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { $set: updates }, { new: true });
  if (!item) return errorResponse(res, 'Motivation item not found', 404);
  return successResponse(res, { item }, 'Motivation item updated');
});

const deleteMotivation = asyncHandler(async (req, res) => {
  const item = await MotivationItem.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!item) return errorResponse(res, 'Motivation item not found', 404);
  return successResponse(res, {}, 'Motivation item deleted');
});

module.exports = { getMotivation, createMotivation, updateMotivation, deleteMotivation };
