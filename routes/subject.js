const express = require('express');
const router = express.Router();
const { getSubjects, createSubject, getSubject, updateSubject, deleteSubject } = require('../controllers/subjectController');
const { protect } = require('../middlewares/auth');
router.use(protect);
router.route('/').get(getSubjects).post(createSubject);
router.route('/:id').get(getSubject).put(updateSubject).delete(deleteSubject);
module.exports = router;
