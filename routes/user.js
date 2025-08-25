const express = require('express');
const router = express.Router();
const userController = require('../controllers/user');
const {auth} = require('../middleware/auth');
const {getProfile, getAllUsers, getUserAppointments, updateBlockStatus} = require('../controllers/user');

// Get own profile
router.get('/profile', auth(['user', 'admin']), getProfile);

// Get all users (admin only)
router.get('/all', auth('admin'), getAllUsers);

// Get user-specific appointments
router.get('/appointments', auth('user'), getUserAppointments);

// Block or unblock a user (admin only, add auth middleware as needed)
router.put('/:userId/block', auth('admin'), updateBlockStatus);


module.exports = router;
