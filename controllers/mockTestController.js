const MockTest = require('../models/MockTest');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse, errorResponse } = require('../utils/response');

const getMockTests = asyncHandler(async (req, res) => {
  const filter = { user: req.user._id };
  if (req.query.examId) filter.exam = req.query.examId;
  const tests = await MockTest.find(filter).populate('exam', 'name').sort({ takenAt: -1 });
  return successResponse(res, { tests }, 'Mock tests retrieved');
});

const createMockTest = asyncHandler(async (req, res) => {
  const test = await MockTest.create({ user: req.user._id, ...req.body });
  return successResponse(res, { test }, 'Mock test logged', 201);
});

const updateMockTest = asyncHandler(async (req, res) => {
  const test = await MockTest.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { $set: req.body }, { new: true, runValidators: true });
  if (!test) return errorResponse(res, 'Test not found', 404);
  return successResponse(res, { test }, 'Test updated');
});

const deleteMockTest = asyncHandler(async (req, res) => {
  const test = await MockTest.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!test) return errorResponse(res, 'Test not found', 404);
  return successResponse(res, {}, 'Test deleted');
});

const getMockTestTrends = asyncHandler(async (req, res) => {
  const examId = req.query.examId;
  const filter = { user: req.user._id };
  if (examId) filter.exam = examId;
  const tests = await MockTest.find(filter).sort({ takenAt: 1 });
  const trends = tests.map(t => ({ date: t.takenAt, score: t.score, maxScore: t.maxScore, percentage: Math.round((t.score / t.maxScore) * 100), accuracy: t.accuracy, name: t.name }));
  return successResponse(res, { trends }, 'Trends retrieved');
});

module.exports = { getMockTests, createMockTest, updateMockTest, deleteMockTest, getMockTestTrends };
