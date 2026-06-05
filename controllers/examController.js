const Exam = require('../models/Exam');
const Subject = require('../models/Subject');
const Topic = require('../models/Topic');
const StudySession = require('../models/StudySession');
const MockTest = require('../models/MockTest');
const RevisionItem = require('../models/RevisionItem');
const Mistake = require('../models/Mistake');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse, errorResponse } = require('../utils/response');

const getExams = asyncHandler(async (req, res) => {
  const exams = await Exam.find({ user: req.user._id })
    .populate('subjects', 'name color icon totalStudyHours completionPercentage')
    .sort({ isPrimary: -1, examDate: 1 });
  return successResponse(res, { exams }, 'Exams retrieved');
});

const createExam = asyncHandler(async (req, res) => {
  const { name, category, description, examDate, targetScore, targetRank, totalMarks, passingMarks, color, icon, isPrimary } = req.body;
  if (isPrimary) await Exam.updateMany({ user: req.user._id }, { isPrimary: false });
  const exam = await Exam.create({
    user: req.user._id, name, category, description, examDate, targetScore, targetRank,
    totalMarks, passingMarks, color: color || '#3B82F6', icon: icon || 'BookOpen', isPrimary: isPrimary || false,
  });
  return successResponse(res, { exam }, 'Exam created', 201);
});

const getExam = asyncHandler(async (req, res) => {
  const exam = await Exam.findOne({ _id: req.params.id, user: req.user._id }).populate('subjects');
  if (!exam) return errorResponse(res, 'Exam not found', 404);
  return successResponse(res, { exam }, 'Exam retrieved');
});

const updateExam = asyncHandler(async (req, res) => {
  const allowedFields = ['name','category','description','examDate','targetScore','targetRank','totalMarks','passingMarks','color','icon','isActive','isPrimary','notes'];
  if (req.body.isPrimary) await Exam.updateMany({ user: req.user._id, _id: { $ne: req.params.id } }, { isPrimary: false });
  const updates = {};
  allowedFields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
  if (Object.keys(updates).length === 0) {
    return errorResponse(res, 'No valid exam fields provided for update', 400);
  }
  const exam = await Exam.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { $set: updates }, { new: true, runValidators: true });
  if (!exam) return errorResponse(res, 'Exam not found', 404);
  return successResponse(res, { exam }, 'Exam updated');
});

const deleteExam = asyncHandler(async (req, res) => {
  const exam = await Exam.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!exam) return errorResponse(res, 'Exam not found', 404);
  return successResponse(res, {}, 'Exam deleted');
});

const getExamReadiness = asyncHandler(async (req, res) => {
  const exam = await Exam.findOne({ _id: req.params.id, user: req.user._id }).populate('subjects');
  if (!exam) return errorResponse(res, 'Exam not found', 404);
  const subjects = await Subject.find({ exam: exam._id, user: req.user._id });
  const subjectIds = subjects.map(subject => subject._id);
  const mockTests = await MockTest.find({ exam: exam._id, user: req.user._id }).sort({ takenAt: -1 }).limit(10);
  const [topics, revisions, unresolvedMistakes] = await Promise.all([
    Topic.find({ user: req.user._id, subject: { $in: subjectIds } }).populate('subject', 'name color'),
    RevisionItem.find({ user: req.user._id, subject: { $in: subjectIds } }),
    Mistake.find({ user: req.user._id, subject: { $in: subjectIds }, isResolved: false }).populate('subject', 'name color'),
  ]);
  const now = new Date();
  const daysLeft = Math.max(1, Math.ceil((exam.examDate - now) / (1000 * 60 * 60 * 24)));
  const completionScore = topics.length > 0
    ? (topics.filter(topic => topic.isCompleted).length / topics.length) * 100
    : subjects.length > 0 ? subjects.reduce((acc, s) => acc + s.completionPercentage, 0) / subjects.length : 0;
  const recentSessions = await StudySession.find({
    user: req.user._id,
    isActive: false,
    startTime: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    $or: [{ exam: exam._id }, { subject: { $in: subjectIds } }],
  });
  const totalHoursLast30 = recentSessions.reduce((acc, s) => acc + (s.duration / 3600), 0);
  const avgMockScore = mockTests.length > 0 ? mockTests.reduce((acc, t) => acc + (t.score / t.maxScore) * 100, 0) / mockTests.length : 0;
  const studiedDays = new Set(recentSessions.map(session => session.date || session.startTime.toISOString().split('T')[0])).size;
  const consistencyScore = Math.min(100, (studiedDays / Math.min(30, Math.max(1, daysLeft))) * 100);
  const revisionSlots = revisions.flatMap(revision => revision.schedule || []);
  const completedRevisionSlots = revisionSlots.filter(slot => slot.isCompleted).length;
  const revisionScore = revisionSlots.length ? (completedRevisionSlots / revisionSlots.length) * 100 : Math.min(100, completionScore * 0.5);
  const mistakePenalty = Math.min(18, unresolvedMistakes.length * 3);
  const readinessScore = Math.max(0, Math.min(100, Math.round(
    (completionScore * 0.35) +
    (consistencyScore * 0.2) +
    (avgMockScore * 0.25) +
    (revisionScore * 0.2) -
    mistakePenalty
  )));
  const strongAreas = subjects.filter(s => s.completionPercentage >= 70).map(s => s.name);
  const weakAreas = [
    ...subjects.filter(s => s.completionPercentage < 45).map(s => s.name),
    ...unresolvedMistakes.map(mistake => mistake.subject?.name).filter(Boolean),
  ].filter((name, index, arr) => arr.indexOf(name) === index).slice(0, 8);
  const remainingTopics = topics.filter(topic => !topic.isCompleted);
  const estimatedHoursRemaining = remainingTopics.reduce((sum, topic) => sum + (topic.estimatedHours || 2), 0);
  const hoursNeeded = Math.max(estimatedHoursRemaining, (100 - readinessScore) * 0.75);
  const requiredDailyHours = Number((hoursNeeded / daysLeft).toFixed(1));
  const predictedCompletionDays = Math.ceil(hoursNeeded / Math.max(1, totalHoursLast30 / 30));
  const prediction = {
    readinessScore, strongAreas, weakAreas, daysLeft,
    totalHoursLast30: Math.round(totalHoursLast30), completionPercentage: Math.round(completionScore),
    avgMockScore: Math.round(avgMockScore), hoursNeeded: Math.round(hoursNeeded),
    requiredDailyHours,
    consistencyScore: Math.round(consistencyScore),
    revisionScore: Math.round(revisionScore),
    unresolvedMistakes: unresolvedMistakes.length,
    componentScores: {
      syllabus: Math.round(completionScore),
      consistency: Math.round(consistencyScore),
      mocks: Math.round(avgMockScore),
      revision: Math.round(revisionScore),
      mistakePenalty,
    },
    predictedCompletionDate: new Date(Date.now() + predictedCompletionDays * 24 * 60 * 60 * 1000),
    recommendation: readinessScore >= 80 ? 'Excellent preparation! Focus on mock tests and revision.'
      : readinessScore >= 60 ? 'Good progress. Strengthen weak areas and increase consistency.'
      : readinessScore >= 40 ? 'More focused study needed. Create a structured daily plan.'
      : 'Immediate action required. Set daily goals and track consistently.',
  };
  await Exam.findByIdAndUpdate(exam._id, { readinessScore });
  return successResponse(res, { prediction }, 'Readiness prediction generated');
});

module.exports = { getExams, createExam, getExam, updateExam, deleteExam, getExamReadiness };
