const mongoose = require('mongoose');

const goalSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, maxlength: 500, default: '' },
    type: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'yearly', 'custom'],
      required: true,
    },
    category: {
      type: String,
      enum: ['hours', 'topics', 'subjects', 'sessions', 'score', 'custom'],
      default: 'hours',
    },
    targetValue: { type: Number, required: true },
    currentValue: { type: Number, default: 0 },
    unit: { type: String, default: 'hours' },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', default: null },
    exam: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', default: null },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
    color: { type: String, default: '#3B82F6' },
    milestones: [
      {
        value: Number,
        label: String,
        isReached: { type: Boolean, default: false },
        reachedAt: Date,
      },
    ],
    recurringConfig: {
      isRecurring: { type: Boolean, default: false },
      frequency: { type: String, enum: ['daily', 'weekly', 'monthly'], default: 'weekly' },
    },
  },
  { timestamps: true }
);

goalSchema.virtual('progressPercentage').get(function () {
  if (this.targetValue === 0) return 0;
  return Math.min(100, Math.round((this.currentValue / this.targetValue) * 100));
});

goalSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Goal', goalSchema);
