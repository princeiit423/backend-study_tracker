const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    exam: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', default: null },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, maxlength: 300, default: '' },
    color: { type: String, default: '#3B82F6' },
    icon: { type: String, default: 'Book' },
    goalHours: { type: Number, default: 0 },
    totalStudyHours: { type: Number, default: 0 },
    priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard', 'expert'], default: 'medium' },
    completionPercentage: { type: Number, default: 0, min: 0, max: 100 },
    isArchived: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Subject', subjectSchema);
