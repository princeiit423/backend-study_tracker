const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const PasswordResetToken = require('../models/PasswordResetToken');
const asyncHandler = require('../utils/asyncHandler');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
} = require('../utils/jwt');
const { successResponse, errorResponse } = require('../utils/response');

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const sanitizeName = (name, email) => {
  const cleanName = String(name || '').trim();
  return cleanName || email.split('@')[0] || 'AceStudy User';
};

const issueTokens = async (res, user) => {
  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  user.refreshTokens = user.refreshTokens || [];
  user.refreshTokens.push({ token: refreshToken, createdAt: new Date() });

  if (user.refreshTokens.length > 5) {
    user.refreshTokens = user.refreshTokens.slice(-5);
  }

  await user.save();
  setRefreshTokenCookie(res, refreshToken);

  return { accessToken };
};

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// @desc    Register with email and password
// @route   POST /api/auth/register
const register = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const name = sanitizeName(req.body.name, email);
  const password = String(req.body.password || '');

  if (!name || !email || !password) {
    return errorResponse(res, 'Name, email, and password are required', 400);
  }

  if (!isValidEmail(email)) {
    return errorResponse(res, 'Please enter a valid email address', 400);
  }

  if (password.length < 8) {
    return errorResponse(res, 'Password must be at least 8 characters', 400);
  }

  const existingUser = await User.findOne({ email }).select('+passwordHash');
  if (existingUser) {
    return errorResponse(res, 'An account with this email already exists', 409);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({
    name,
    email,
    passwordHash,
    avatar: '',
    isOnboarded: false,
  });

  const { accessToken } = await issueTokens(res, user);

  return successResponse(
    res,
    { accessToken, user: user.toPublicJSON(), isNewUser: true },
    'Account created successfully',
    201
  );
});

// @desc    Login with email and password
// @route   POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '');

  if (!email || !password) {
    return errorResponse(res, 'Email and password are required', 400);
  }

  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user || !user.passwordHash) {
    return errorResponse(res, 'Invalid email or password', 401);
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    return errorResponse(res, 'Invalid email or password', 401);
  }

  const { accessToken } = await issueTokens(res, user);

  return successResponse(
    res,
    { accessToken, user: user.toPublicJSON(), isNewUser: false },
    'Signed in successfully'
  );
});

// @desc    Refresh access token
// @route   POST /api/auth/refresh
const refreshToken = asyncHandler(async (req, res) => {
  const token = req.signedCookies?.refreshToken || req.cookies?.refreshToken;

  if (!token) {
    return errorResponse(res, 'No refresh token', 401);
  }

  const decoded = verifyRefreshToken(token);
  const user = await User.findById(decoded.id);

  if (!user) {
    return errorResponse(res, 'User not found', 401);
  }

  const storedToken = user.refreshTokens?.find((entry) => entry.token === token);
  if (!storedToken) {
    return errorResponse(res, 'Invalid refresh token', 401);
  }

  const newAccessToken = generateAccessToken(user._id);
  const newRefreshToken = generateRefreshToken(user._id);

  user.refreshTokens = user.refreshTokens.filter((entry) => entry.token !== token);
  user.refreshTokens.push({ token: newRefreshToken, createdAt: new Date() });

  if (user.refreshTokens.length > 5) {
    user.refreshTokens = user.refreshTokens.slice(-5);
  }

  await user.save();
  setRefreshTokenCookie(res, newRefreshToken);

  return successResponse(res, { accessToken: newAccessToken }, 'Token refreshed');
});

// @desc    Request a password reset token
// @route   POST /api/auth/forgot-password
const forgotPassword = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  if (!email) return errorResponse(res, 'Email is required', 400);

  const user = await User.findOne({ email });
  if (!user) {
    return successResponse(res, {}, 'If an account exists, a reset token has been generated');
  }

  const resetToken = crypto.randomBytes(24).toString('hex');
  await PasswordResetToken.create({
    user: user._id,
    tokenHash: hashToken(resetToken),
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  });

  return successResponse(res, { resetToken }, 'Password reset token generated');
});

// @desc    Reset password using a reset token
// @route   POST /api/auth/reset-password
const resetPassword = asyncHandler(async (req, res) => {
  const token = String(req.body.token || '').trim();
  const password = String(req.body.password || '');

  if (!token || !password) return errorResponse(res, 'Token and new password are required', 400);
  if (password.length < 8) return errorResponse(res, 'Password must be at least 8 characters', 400);

  const reset = await PasswordResetToken.findOne({
    tokenHash: hashToken(token),
    usedAt: null,
    expiresAt: { $gt: new Date() },
  });

  if (!reset) return errorResponse(res, 'Invalid or expired reset token', 400);

  const user = await User.findById(reset.user).select('+passwordHash');
  if (!user) return errorResponse(res, 'User not found', 404);

  user.passwordHash = await bcrypt.hash(password, 12);
  user.refreshTokens = [];
  await user.save();

  reset.usedAt = new Date();
  await reset.save();

  clearRefreshTokenCookie(res);
  return successResponse(res, {}, 'Password reset successfully');
});

// @desc    Logout
// @route   POST /api/auth/logout
const logout = asyncHandler(async (req, res) => {
  const token = req.signedCookies?.refreshToken || req.cookies?.refreshToken;

  if (token) {
    const user = await User.findOne({ 'refreshTokens.token': token });
    if (user) {
      user.refreshTokens = user.refreshTokens.filter((entry) => entry.token !== token);
      await user.save();
    }
  }

  clearRefreshTokenCookie(res);
  return successResponse(res, {}, 'Logged out successfully');
});

// @desc    Get current user
// @route   GET /api/auth/me
const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  return successResponse(res, { user: user.toPublicJSON() }, 'User retrieved');
});

module.exports = { register, login, refreshToken, forgotPassword, resetPassword, logout, getMe };
