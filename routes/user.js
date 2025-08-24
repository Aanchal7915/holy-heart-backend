const express = require('express');
const router = express.Router();
const userController = require('../controllers/user');
const {auth} = require('../middleware/auth');
const userAppointmentsController = require('../controllers/user');

// Get own profile
router.get('/profile', auth('user'), userController.getProfile);

// Get all users (admin only)
router.get('/all', auth('admin'), userController.getAllUsers);

// Get user-specific appointments
router.get('/appointments', auth('user'), userAppointmentsController.getUserAppointments);

module.exports = router;
