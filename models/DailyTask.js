const mongoose = require('mongoose');

const dailyTaskSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    date: { type: String, required: true },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', default: null },
    topic: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', default: null },
    goal: { type: mongoose.Schema.Types.ObjectId, ref: 'Goal', default: null },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

dailyTaskSchema.index({ user: 1, date: 1, isCompleted: 1 });

module.exports = mongoose.model('DailyTask', dailyTaskSchema);
