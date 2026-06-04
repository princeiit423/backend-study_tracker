const express = require('express');
const router = express.Router();
const { getMotivation, createMotivation, updateMotivation, deleteMotivation } = require('../controllers/motivationController');
const { protect } = require('../middlewares/auth');

router.use(protect);
router.route('/').get(getMotivation).post(createMotivation);
router.route('/:id').put(updateMotivation).delete(deleteMotivation);

module.exports = router;
