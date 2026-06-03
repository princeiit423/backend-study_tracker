const mongoose = require('mongoose');

const mockTestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    exam: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', default: null },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    platform: { type: String, trim: true, default: '' },
    takenAt: { type: Date, required: true },
    duration: { type: Number, default: 0 }, // in minutes
    totalQuestions: { type: Number, default: 0 },
    attemptedQuestions: { type: Number, default: 0 },
    correctAnswers: { type: Number, default: 0 },
    wrongAnswers: { type: Number, default: 0 },
    score: { type: Number, required: true },
    maxScore: { type: Number, required: true },
    accuracy: { type: Number, default: 0 }, // percentage
    percentile: { type: Number, default: null },
    rank: { type: String, default: '' },
    subjectWiseScores: [
      {
        subject: String,
        score: Number,
        maxScore: Number,
        accuracy: Number,
      },
    ],
    strengths: [{ type: String }],
    weaknesses: [{ type: String }],
    notes: { type: String, maxlength: 1000, default: '' },
    topics: [{ type: String }],
  },
  { timestamps: true }
);

mockTestSchema.pre('save', function (next) {
  if (this.attemptedQuestions > 0) {
    this.accuracy = Math.round((this.correctAnswers / this.attemptedQuestions) * 100);
  }
  next();
});

module.exports = mongoose.model('MockTest', mockTestSchema);
