const mongoose = require('mongoose');

const examSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    category: { type: String, trim: true, default: '' },
    description: { type: String, maxlength: 500, default: '' },
    examDate: { type: Date, required: true },
    targetScore: { type: String, default: '' },
    targetRank: { type: String, default: '' },
    totalMarks: { type: Number, default: null },
    passingMarks: { type: Number, default: null },
    isActive: { type: Boolean, default: true },
    isPrimary: { type: Boolean, default: false },
    color: { type: String, default: '#3B82F6' },
    icon: { type: String, default: 'BookOpen' },
    subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
    readinessScore: { type: Number, default: 0, min: 0, max: 100 },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

examSchema.virtual('daysLeft').get(function () {
  const now = new Date();
  const diff = this.examDate - now;
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
});

examSchema.set('toJSON', { virtuals: true });
examSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Exam', examSchema);
