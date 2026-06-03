const express = require('express');
const router = express.Router();
const { getAchievements } = require('../controllers/achievementController');
const { protect } = require('../middlewares/auth');
router.use(protect);
router.get('/', getAchievements);
module.exports = router;
