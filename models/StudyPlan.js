const mongoose = require('mongoose');

const studyPlanSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    exam: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', default: null },
    examDate: { type: Date, required: true },
    dailyHours: { type: Number, default: 4, min: 1, max: 16 },
    weakSubjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
    days: [
      {
        date: String,
        subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', default: null },
        topic: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', default: null },
        title: String,
        targetHours: Number,
        isRevision: { type: Boolean, default: false },
        isCompleted: { type: Boolean, default: false },
      },
    ],
  },
  { timestamps: true }
);

studyPlanSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('StudyPlan', studyPlanSchema);
