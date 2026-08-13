const express = require("express");

const { getAdminDashboard } = require('../Controllers/adminDashController');

const { protect, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', protect, authorizeRoles('admin'), getAdminDashboard);

module.exports = router;