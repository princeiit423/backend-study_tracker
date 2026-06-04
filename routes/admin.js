const express = require('express');
const router = express.Router();
const { getAdminOverview, getAdminUsers } = require('../controllers/adminController');
const { protect } = require('../middlewares/auth');
const { requireAdmin } = require('../middlewares/admin');

router.use(protect, requireAdmin);
router.get('/overview', getAdminOverview);
router.get('/users', getAdminUsers);

module.exports = router;
