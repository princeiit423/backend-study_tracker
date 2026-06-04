const mongoose = require('mongoose');

const mistakeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', default: null },
    topic: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', default: null },
    topicText: { type: String, trim: true, maxlength: 160, default: '' },
    mockTest: { type: mongoose.Schema.Types.ObjectId, ref: 'MockTest', default: null },
    question: { type: String, trim: true, maxlength: 500, default: '' },
    mistake: { type: String, required: true, trim: true, maxlength: 1000 },
    reason: { type: String, enum: ['concept_gap', 'silly_mistake', 'time_pressure', 'calculation', 'memory', 'other'], default: 'other' },
    fix: { type: String, trim: true, maxlength: 1000, default: '' },
    isResolved: { type: Boolean, default: false },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

mistakeSchema.index({ user: 1, isResolved: 1, createdAt: -1 });

module.exports = mongoose.model('Mistake', mistakeSchema);
