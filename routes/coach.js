const express = require('express');
const router = express.Router();
const { getWeaknessReview, getSmartQueue, getWeeklyReport, quickCapture, importSyllabus } = require('../controllers/coachController');
const { protect } = require('../middlewares/auth');

router.use(protect);
router.get('/weakness', getWeaknessReview);
router.get('/queue', getSmartQueue);
router.get('/weekly-report', getWeeklyReport);
router.post('/quick-capture', quickCapture);
router.post('/import-syllabus', importSyllabus);

module.exports = router;
