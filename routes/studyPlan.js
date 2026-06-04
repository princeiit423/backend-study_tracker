const express = require('express');
const router = express.Router();
const { getStudyPlans, generateStudyPlan, updateStudyPlanDay, deleteStudyPlan } = require('../controllers/studyPlanController');
const { protect } = require('../middlewares/auth');

router.use(protect);
router.route('/').get(getStudyPlans).post(generateStudyPlan);
router.put('/:id/days/:dayId', updateStudyPlanDay);
router.delete('/:id', deleteStudyPlan);

module.exports = router;
