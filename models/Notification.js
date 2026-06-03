const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ['achievement', 'goal', 'streak', 'reminder', 'exam', 'system', 'milestone'],
      default: 'system',
    },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
    actionUrl: { type: String, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
