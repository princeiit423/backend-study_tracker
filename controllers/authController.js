const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
} = require('../utils/jwt');
const { successResponse, errorResponse } = require('../utils/response');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// @desc    Google OAuth Sign In/Sign Up
// @route   POST /api/auth/google
const googleAuth = asyncHandler(async (req, res) => {
  const { credential, clientId } = req.body;

  if (!credential) {
    return errorResponse(res, 'Google credential is required', 400);
  }

  // Verify Google token
  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  const { sub: googleId, email, name, picture } = payload;

  if (!email) {
    return errorResponse(res, 'Email not provided by Google', 400);
  }

  // Find or create user
  let user = await User.findOne({ $or: [{ googleId }, { email }] });
  const isNewUser = !user;

  if (!user) {
    user = await User.create({
      name,
      email,
      googleId,
      avatar: picture || '',
      isOnboarded: false,
    });
  } else {
    // Update existing user
    if (!user.googleId) user.googleId = googleId;
    if (picture && !user.avatar) user.avatar = picture;
    if (name && !user.name) user.name = name;
  }

  // Generate tokens
  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  // Store refresh token
  user.refreshTokens = user.refreshTokens || [];
  user.refreshTokens.push({ token: refreshToken, createdAt: new Date() });

  // Keep only last 5 refresh tokens
  if (user.refreshTokens.length > 5) {
    user.refreshTokens = user.refreshTokens.slice(-5);
  }

  await user.save();

  setRefreshTokenCookie(res, refreshToken);

  return successResponse(
    res,
    {
      accessToken,
      user: user.toPublicJSON(),
      isNewUser,
    },
    isNewUser ? 'Account created successfully' : 'Signed in successfully',
    isNewUser ? 201 : 200
  );
});

// @desc    Refresh access token
// @route   POST /api/auth/refresh
const refreshToken = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken;

  if (!token) {
    return errorResponse(res, 'No refresh token', 401);
  }

  const decoded = verifyRefreshToken(token);
  const user = await User.findById(decoded.id);

  if (!user) {
    return errorResponse(res, 'User not found', 401);
  }

  const storedToken = user.refreshTokens?.find((t) => t.token === token);
  if (!storedToken) {
    return errorResponse(res, 'Invalid refresh token', 401);
  }

  const newAccessToken = generateAccessToken(user._id);
  const newRefreshToken = generateRefreshToken(user._id);

  // Rotate refresh token
  user.refreshTokens = user.refreshTokens.filter((t) => t.token !== token);
  user.refreshTokens.push({ token: newRefreshToken, createdAt: new Date() });
  await user.save();

  setRefreshTokenCookie(res, newRefreshToken);

  return successResponse(res, { accessToken: newAccessToken }, 'Token refreshed');
});

// @desc    Logout
// @route   POST /api/auth/logout
const logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken;

  if (token) {
    const user = await User.findOne({ 'refreshTokens.token': token });
    if (user) {
      user.refreshTokens = user.refreshTokens.filter((t) => t.token !== token);
      await user.save();
    }
  }

  clearRefreshTokenCookie(res);
  return successResponse(res, {}, 'Logged out successfully');
});

// @desc    Get current user
// @route   GET /api/auth/me
const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('-refreshTokens');
  return successResponse(res, { user }, 'User retrieved');
});

module.exports = { googleAuth, refreshToken, logout, getMe };
