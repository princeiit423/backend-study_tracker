const express = require('express');
const router = express.Router();
const { getCalendarEvents, createCalendarEvent, deleteCalendarEvent } = require('../controllers/calendarController');
const { protect } = require('../middlewares/auth');

router.use(protect);
router.route('/').get(getCalendarEvents).post(createCalendarEvent);
router.delete('/:id', deleteCalendarEvent);

module.exports = router;
