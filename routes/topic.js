const express = require('express');
const router = express.Router();
const { getTopics, createTopic, updateTopic, deleteTopic, bulkUpdateTopics } = require('../controllers/topicController');
const { protect } = require('../middlewares/auth');
router.use(protect);
router.route('/').get(getTopics).post(createTopic);
router.put('/bulk', bulkUpdateTopics);
router.route('/:id').put(updateTopic).delete(deleteTopic);
module.exports = router;
