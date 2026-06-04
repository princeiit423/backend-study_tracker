const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, select: false },
    avatar: { type: String, default: '' },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },

    // Onboarding
    isOnboarded: { type: Boolean, default: false },

    // Profile
    timezone: { type: String, default: 'Asia/Kolkata' },
    bio: { type: String, maxlength: 300, default: '' },
    phone: { type: String, default: '' },

    // Study Preferences
    preferences: {
      dailyGoalHours: { type: Number, default: 4 },
      weeklyGoalHours: { type: Number, default: 28 },
      preferredStudyStart: { type: String, default: '09:00' },
      preferredStudyEnd: { type: String, default: '22:00' },
      restDays: [{ type: String, enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] }],
      pomodoroWork: { type: Number, default: 25 },
      pomodoroBreak: { type: Number, default: 5 },
      pomodoroLongBreak: { type: Number, default: 15 },
      pomodoroSessions: { type: Number, default: 4 },
    },

    // Theme
    theme: {
      mode: { type: String, enum: ['light', 'dark', 'system'], default: 'dark' },
      accent: { type: String, default: 'blue' },
      customColors: { type: mongoose.Schema.Types.Mixed, default: {} },
    },

    // Dashboard layout
    dashboardLayout: { type: mongoose.Schema.Types.Mixed, default: null },

    // Gamification
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    badges: [{ type: String }],
    totalStudyHours: { type: Number, default: 0 },

    // Streaks
    currentStreak: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    lastStudyDate: { type: Date, default: null },

    // Auth
    refreshTokens: [{ token: String, createdAt: Date }],

    // Privacy
    isPublicProfile: { type: Boolean, default: false },
    showOnLeaderboard: { type: Boolean, default: true },

    // Notifications
    notificationSettings: {
      studyReminder: { type: Boolean, default: true },
      goalReminder: { type: Boolean, default: true },
      examReminder: { type: Boolean, default: true },
      streakReminder: { type: Boolean, default: true },
      achievementAlerts: { type: Boolean, default: true },
      reminderTime: { type: String, default: '08:00' },
    },
  },
  { timestamps: true }
);

// Level calculation
userSchema.methods.calculateLevel = function () {
  const xpThresholds = [0, 100, 250, 500, 1000, 2000, 3500, 5500, 8000, 11500, 16000];
  let level = 1;
  for (let i = 0; i < xpThresholds.length; i++) {
    if (this.xp >= xpThresholds[i]) level = i + 1;
    else break;
  }
  return Math.min(level, 10);
};

userSchema.methods.toPublicJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.refreshTokens;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
