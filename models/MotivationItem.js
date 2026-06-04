const mongoose = require('mongoose');

const motivationItemSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    body: { type: String, trim: true, maxlength: 800, default: '' },
    type: { type: String, enum: ['reason', 'quote', 'goal', 'reward', 'promise'], default: 'reason' },
    isPinned: { type: Boolean, default: false },
  },
  { timestamps: true }
);

motivationItemSchema.index({ user: 1, isPinned: -1, createdAt: -1 });

module.exports = mongoose.model('MotivationItem', motivationItemSchema);
