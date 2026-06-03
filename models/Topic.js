const mongoose = require('mongoose');

const topicSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    parentTopic: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', default: null },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, maxlength: 500, default: '' },
    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard', 'expert'], default: 'medium' },
    estimatedHours: { type: Number, default: 0 },
    actualHours: { type: Number, default: 0 },
    confidenceLevel: { type: Number, default: 0, min: 0, max: 5 },
    tags: [{ type: String, trim: true }],
    order: { type: Number, default: 0 },
    resources: [
      {
        title: String,
        url: String,
        type: { type: String, enum: ['video', 'article', 'book', 'pdf', 'other'], default: 'other' },
      },
    ],
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Topic', topicSchema);
