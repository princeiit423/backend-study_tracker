const express = require('express');
const router = express.Router();
const { syncUser, logout, getMe } = require('../controllers/authController');
const { protect } = require('../middlewares/auth');
router.post('/sync', protect, syncUser);
router.post('/logout', logout);
router.get('/me', protect, getMe);
module.exports = router;
