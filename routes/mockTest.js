const express = require('express');
const router = express.Router();
const { getMockTests, createMockTest, updateMockTest, deleteMockTest, getMockTestTrends } = require('../controllers/mockTestController');
const { protect } = require('../middlewares/auth');
router.use(protect);
router.route('/').get(getMockTests).post(createMockTest);
router.get('/trends', getMockTestTrends);
router.route('/:id').put(updateMockTest).delete(deleteMockTest);
module.exports = router;
