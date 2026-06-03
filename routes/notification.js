const express = require('express');
const router = express.Router();
const { getNotifications, markRead, deleteNotification } = require('../controllers/notificationController');
const { protect } = require('../middlewares/auth');
router.use(protect);
router.get('/', getNotifications);
router.post('/read', markRead);
router.delete('/:id', deleteNotification);
module.exports = router;
