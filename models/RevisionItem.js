const mongoose = require('mongoose');

const revisionItemSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    topic: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', required: true },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', default: null },
    baseDate: { type: Date, required: true },
    schedule: [
      {
        date: String,
        intervalDays: Number,
        isCompleted: { type: Boolean, default: false },
        completedAt: { type: Date, default: null },
      },
    ],
  },
  { timestamps: true }
);

revisionItemSchema.index({ user: 1, topic: 1 });

module.exports = mongoose.model('RevisionItem', revisionItemSchema);
