const express = require('express');
const router = express.Router();
const { getExams, createExam, getExam, updateExam, deleteExam, getExamReadiness } = require('../controllers/examController');
const { protect } = require('../middlewares/auth');
router.use(protect);
router.route('/').get(getExams).post(createExam);
router.route('/:id').get(getExam).put(updateExam).delete(deleteExam);
router.get('/:id/readiness', getExamReadiness);
module.exports = router;
