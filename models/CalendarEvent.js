const mongoose = require('mongoose');

const calendarEventSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    date: { type: String, required: true },
    type: { type: String, enum: ['event', 'deadline', 'holiday', 'reminder'], default: 'event' },
    color: { type: String, default: '#EC4899' },
    notes: { type: String, maxlength: 500, default: '' },
  },
  { timestamps: true }
);

calendarEventSchema.index({ user: 1, date: 1 });

module.exports = mongoose.model('CalendarEvent', calendarEventSchema);
