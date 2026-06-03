const express = require('express');
const router = express.Router();
const { getGoals, createGoal, updateGoal, deleteGoal, syncGoals } = require('../controllers/goalController');
const { protect } = require('../middlewares/auth');
router.use(protect);
router.route('/').get(getGoals).post(createGoal);
router.post('/sync', syncGoals);
router.route('/:id').put(updateGoal).delete(deleteGoal);
module.exports = router;
