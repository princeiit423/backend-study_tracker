const express = require('express');
const router = express.Router();
const { googleAuth, refreshToken, logout, getMe } = require('../controllers/authController');
const { protect } = require('../middlewares/auth');
router.post('/google', googleAuth);
router.post('/refresh', refreshToken);
router.post('/logout', logout);
router.get('/me', protect, getMe);
module.exports = router;
