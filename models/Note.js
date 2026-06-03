const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    content: { type: String, default: '' },
    type: { type: String, enum: ['subject', 'topic', 'quick', 'general'], default: 'general' },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', default: null },
    topic: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', default: null },
    tags: [{ type: String, trim: true }],
    isPinned: { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false },
    color: { type: String, default: '#3B82F6' },
    canvasPosition: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
      width: { type: Number, default: 280 },
      height: { type: Number, default: 220 },
    },
    lastEditedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

noteSchema.index({ user: 1, createdAt: -1 });
noteSchema.index({ user: 1, subject: 1 });

module.exports = mongoose.model('Note', noteSchema);
