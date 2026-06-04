const mongoose = require('mongoose');

const studySessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', default: null },
    topic: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', default: null },
    exam: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', default: null },

    title: { type: String, trim: true, maxlength: 200, default: '' },
    startTime: { type: Date, required: true },
    endTime: { type: Date, default: null },
    duration: { type: Number, default: 0 }, // in seconds
    isActive: { type: Boolean, default: false },
    isPaused: { type: Boolean, default: false },
    pausedAt: { type: Date, default: null },
    totalPausedTime: { type: Number, default: 0 }, // in seconds

    mode: {
      type: String,
      enum: ['pomodoro', 'deep_work', 'manual', 'standard'],
      default: 'standard',
    },

    pomodoroCount: { type: Number, default: 0 },

    notes: { type: String, maxlength: 2000, default: '' },
    mood: {
      type: String,
      enum: ['terrible', 'bad', 'neutral', 'good', 'great'],
      default: 'neutral',
    },
    focusScore: { type: Number, default: 5, min: 1, max: 10 },
    productivityRating: { type: Number, default: 5, min: 1, max: 10 },
    qualityScore: { type: Number, default: 0, min: 0, max: 100 },
    reflection: {
      completed: { type: String, trim: true, maxlength: 800, default: '' },
      blockers: { type: String, trim: true, maxlength: 800, default: '' },
      nextAction: { type: String, trim: true, maxlength: 500, default: '' },
      distractions: { type: Number, default: 0, min: 0, max: 99 },
    },

    // Date for easy querying
    date: { type: String }, // YYYY-MM-DD

    // XP earned
    xpEarned: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Pre-save: set date field
studySessionSchema.pre('save', function (next) {
  if (this.startTime) {
    this.date = this.startTime.toISOString().split('T')[0];
  }
  next();
});

studySessionSchema.index({ user: 1, date: -1 });
studySessionSchema.index({ user: 1, startTime: -1 });
studySessionSchema.index({ user: 1, subject: 1 });

module.exports = mongoose.model('StudySession', studySessionSchema);
