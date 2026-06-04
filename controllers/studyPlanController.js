const StudyPlan = require('../models/StudyPlan');
const Subject = require('../models/Subject');
const Topic = require('../models/Topic');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse, errorResponse } = require('../utils/response');

const dateKey = (date) => date.toISOString().split('T')[0];

const getStudyPlans = asyncHandler(async (req, res) => {
  const plans = await StudyPlan.find({ user: req.user._id })
    .populate('exam', 'name examDate')
    .populate('weakSubjects', 'name color')
    .populate('days.subject', 'name color')
    .populate('days.topic', 'name')
    .sort({ createdAt: -1 });
  return successResponse(res, { plans }, 'Study plans retrieved');
});

const generateStudyPlan = asyncHandler(async (req, res) => {
  const title = req.body.title || 'Exam Study Plan';
  const examDate = new Date(req.body.examDate);
  const dailyHours = Number(req.body.dailyHours || 4);
  const weakSubjects = req.body.weakSubjects || [];
  const subjectIds = req.body.subjects?.length ? req.body.subjects : null;

  if (!examDate || Number.isNaN(examDate.getTime()) || examDate <= new Date()) {
    return errorResponse(res, 'A future exam date is required', 400);
  }

  const subjects = await Subject.find({
    user: req.user._id,
    ...(subjectIds ? { _id: { $in: subjectIds } } : {}),
  }).sort({ createdAt: 1 });

  if (!subjects.length) return errorResponse(res, 'Add at least one subject before generating a plan', 400);

  const topics = await Topic.find({ user: req.user._id, subject: { $in: subjects.map(s => s._id) } }).sort({ isCompleted: 1, priority: -1, difficulty: -1 });
  const weightedSubjects = subjects.flatMap(subject => {
    const weight = weakSubjects.includes(subject._id.toString()) ? 2 : 1;
    return Array(weight).fill(subject);
  });

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(examDate);
  end.setHours(0, 0, 0, 0);
  const totalDays = Math.max(1, Math.ceil((end - start) / 86400000));
  const days = [];

  for (let i = 0; i < totalDays; i += 1) {
    const current = new Date(start);
    current.setDate(start.getDate() + i);
    const subject = weightedSubjects[i % weightedSubjects.length];
    const subjectTopics = topics.filter(t => t.subject.toString() === subject._id.toString() && !t.isCompleted);
    const topic = subjectTopics[Math.floor(i / weightedSubjects.length) % Math.max(1, subjectTopics.length)];
    const isRevision = i > totalDays * 0.65 || i % 7 === 6;

    days.push({
      date: dateKey(current),
      subject: subject._id,
      topic: topic?._id || null,
      title: isRevision ? `Revise ${subject.name}` : (topic ? `Study ${topic.name}` : `Study ${subject.name}`),
      targetHours: dailyHours,
      isRevision,
    });
  }

  const plan = await StudyPlan.create({
    user: req.user._id,
    title,
    exam: req.body.exam || null,
    examDate,
    dailyHours,
    weakSubjects,
    days,
  });

  const populated = await StudyPlan.findById(plan._id).populate('days.subject', 'name color').populate('days.topic', 'name');
  return successResponse(res, { plan: populated }, 'Study plan generated', 201);
});

const updateStudyPlanDay = asyncHandler(async (req, res) => {
  const plan = await StudyPlan.findOne({ _id: req.params.id, user: req.user._id });
  if (!plan) return errorResponse(res, 'Study plan not found', 404);
  const day = plan.days.id(req.params.dayId);
  if (!day) return errorResponse(res, 'Plan day not found', 404);
  if (req.body.isCompleted !== undefined) day.isCompleted = req.body.isCompleted;
  await plan.save();
  return successResponse(res, { plan }, 'Study plan updated');
});

const deleteStudyPlan = asyncHandler(async (req, res) => {
  const plan = await StudyPlan.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!plan) return errorResponse(res, 'Study plan not found', 404);
  return successResponse(res, {}, 'Study plan deleted');
});

module.exports = { getStudyPlans, generateStudyPlan, updateStudyPlanDay, deleteStudyPlan };
