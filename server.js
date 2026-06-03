const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const logger = require('./utils/logger');
const errorHandler = require('./middlewares/errorHandler');
const { connectDB } = require('./config/database');
const { startReminderService } = require('./services/reminderService');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const examRoutes = require('./routes/exam');
const subjectRoutes = require('./routes/subject');
const topicRoutes = require('./routes/topic');
const sessionRoutes = require('./routes/session');
const goalRoutes = require('./routes/goal');
const analyticsRoutes = require('./routes/analytics');
const achievementRoutes = require('./routes/achievement');
const noteRoutes = require('./routes/note');
const mockTestRoutes = require('./routes/mockTest');
const notificationRoutes = require('./routes/notification');
const leaderboardRoutes = require('./routes/leaderboard');

const app = express();

// Trust proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));
app.use(mongoSanitize());

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api', limiter);

// Auth rate limiter (stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many authentication attempts.' },
});

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(compression());

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// API Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/topics', topicRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/achievements', achievementRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/mock-tests', mockTestRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  startReminderService();
  const server = app.listen(PORT, () => {
    logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(`Port ${PORT} is already in use. Stop the existing backend process or set a different PORT in backend/.env.`);
      process.exit(1);
    }
    logger.error(`Server failed to start: ${err.message}`);
    process.exit(1);
  });

  return server;
};

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
