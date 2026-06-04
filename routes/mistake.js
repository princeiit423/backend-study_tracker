const express = require('express');
const router = express.Router();
const { getMistakes, createMistake, updateMistake, deleteMistake } = require('../controllers/mistakeController');
const { protect } = require('../middlewares/auth');

router.use(protect);
router.route('/').get(getMistakes).post(createMistake);
router.route('/:id').put(updateMistake).delete(deleteMistake);

module.exports = router;
