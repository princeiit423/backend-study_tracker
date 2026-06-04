const Subject = require('../models/Subject');
const Topic = require('../models/Topic');
const Exam = require('../models/Exam');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse, errorResponse } = require('../utils/response');

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getSubjects = asyncHandler(async (req, res) => {
  const filter = { user: req.user._id, isArchived: false };
  if (req.query.examId) filter.exam = req.query.examId;
  const subjects = await Subject.find(filter).populate('exam', 'name color').sort({ order: 1, createdAt: -1 });
  return successResponse(res, { subjects }, 'Subjects retrieved');
});

const createSubject = asyncHandler(async (req, res) => {
  const { name, description, color, icon, goalHours, priority, difficulty, exam } = req.body;
  const existing = await Subject.findOne({ user: req.user._id, name: new RegExp(`^${escapeRegex(String(name).trim())}$`, 'i'), isArchived: false });
  if (existing) return errorResponse(res, 'A subject with this name already exists', 409);
  if (exam) {
    const examDoc = await Exam.findOne({ _id: exam, user: req.user._id });
    if (!examDoc) return errorResponse(res, 'Exam not found', 404);
  }
  const subject = await Subject.create({ user: req.user._id, name, description, color: color || '#3B82F6', icon: icon || 'Book', goalHours: goalHours || 0, priority: priority || 'medium', difficulty: difficulty || 'medium', exam: exam || null });
  if (exam) await Exam.findByIdAndUpdate(exam, { $addToSet: { subjects: subject._id } });
  return successResponse(res, { subject }, 'Subject created', 201);
});

const getSubject = asyncHandler(async (req, res) => {
  const subject = await Subject.findOne({ _id: req.params.id, user: req.user._id }).populate('exam', 'name');
  if (!subject) return errorResponse(res, 'Subject not found', 404);
  const topics = await Topic.find({ subject: subject._id, user: req.user._id, parentTopic: null }).sort({ order: 1 });
  return successResponse(res, { subject, topics }, 'Subject retrieved');
});

const updateSubject = asyncHandler(async (req, res) => {
  const allowedFields = ['name','description','color','icon','goalHours','priority','difficulty','isArchived','order'];
  const updates = {};
  allowedFields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
  const subject = await Subject.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { $set: updates }, { new: true, runValidators: true });
  if (!subject) return errorResponse(res, 'Subject not found', 404);
  return successResponse(res, { subject }, 'Subject updated');
});

const deleteSubject = asyncHandler(async (req, res) => {
  const subject = await Subject.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!subject) return errorResponse(res, 'Subject not found', 404);
  await Topic.deleteMany({ subject: subject._id });
  if (subject.exam) await Exam.findByIdAndUpdate(subject.exam, { $pull: { subjects: subject._id } });
  return successResponse(res, {}, 'Subject deleted');
});

const updateSubjectProgress = asyncHandler(async (subjectId, userId) => {
  const topics = await Topic.find({ subject: subjectId, user: userId });
  if (topics.length === 0) return;
  const completed = topics.filter(t => t.isCompleted).length;
  const completionPercentage = Math.round((completed / topics.length) * 100);
  await Subject.findByIdAndUpdate(subjectId, { completionPercentage });
});

module.exports = { getSubjects, createSubject, getSubject, updateSubject, deleteSubject, updateSubjectProgress };
