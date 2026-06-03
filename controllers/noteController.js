const Note = require('../models/Note');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse, errorResponse } = require('../utils/response');

const getNotes = asyncHandler(async (req, res) => {
  const filter = { user: req.user._id, isArchived: false };
  if (req.query.subjectId) filter.subject = req.query.subjectId;
  if (req.query.topicId) filter.topic = req.query.topicId;
  if (req.query.type) filter.type = req.query.type;
  if (req.query.search) filter.$text = { $search: req.query.search };
  const notes = await Note.find(filter).populate('subject', 'name color').populate('topic', 'name').sort({ isPinned: -1, lastEditedAt: -1 });
  return successResponse(res, { notes }, 'Notes retrieved');
});

const createNote = asyncHandler(async (req, res) => {
  const { title, content, type, subject, topic, tags, color, canvasPosition } = req.body;
  const note = await Note.create({
    user: req.user._id,
    title,
    content: content || '',
    type: type || 'general',
    subject: subject || null,
    topic: topic || null,
    tags: tags || [],
    color: color || '#3B82F6',
    canvasPosition: canvasPosition || undefined,
  });
  return successResponse(res, { note }, 'Note created', 201);
});

const updateNote = asyncHandler(async (req, res) => {
  const allowedFields = ['title','content','tags','isPinned','isArchived','color','type','subject','topic','canvasPosition'];
  const updates = { lastEditedAt: new Date() };
  allowedFields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
  const note = await Note.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { $set: updates }, { new: true });
  if (!note) return errorResponse(res, 'Note not found', 404);
  return successResponse(res, { note }, 'Note updated');
});

const deleteNote = asyncHandler(async (req, res) => {
  const note = await Note.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!note) return errorResponse(res, 'Note not found', 404);
  return successResponse(res, {}, 'Note deleted');
});

module.exports = { getNotes, createNote, updateNote, deleteNote };
