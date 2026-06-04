const express = require('express');
const router = express.Router();
const { getRevisions, createRevision, updateRevisionSlot, deleteRevision } = require('../controllers/revisionController');
const { protect } = require('../middlewares/auth');

router.use(protect);
router.route('/').get(getRevisions).post(createRevision);
router.put('/:id/slots/:slotId', updateRevisionSlot);
router.delete('/:id', deleteRevision);

module.exports = router;
