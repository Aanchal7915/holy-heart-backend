/**
 * @swagger
 * tags:
 *   name: User
 *   description: User management and profile
 */

const express = require('express');
const router = express.Router();
const userController = require('../controllers/user');
const {auth} = require('../middleware/auth');
const {getProfile, getAllUsers, getUserAppointments, updateBlockStatus} = require('../controllers/user');

/**
 * @swagger
 * /user/profile:
 *   get:
 *     summary: Get user profile
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile fetched successfully
 *       404:
 *         description: User not found
 */
// Get own profile
router.get('/profile', auth(['user', 'admin', 'doctor']), getProfile);

/**
 * @swagger
 * /user/all:
 *   get:
 *     summary: Get all users (admin only, paginated)
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Results per page
 *     responses:
 *       200:
 *         description: List of users
 *       403:
 *         description: Access denied
 */
// Get all users (admin only)
router.get('/all', auth('admin'), getAllUsers);

/**
 * @swagger
 * /user/appointments:
 *   get:
 *     summary: Get user appointments with filters
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: serviceType
 *         schema:
 *           type: string
 *         description: Filter by service type
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by status
 *       - in: query
 *         name: appointmentDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by a specific date (YYYY-MM-DD)
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for range filter
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for range filter
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: Sort by date
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Results per page
 *     responses:
 *       200:
 *         description: List of appointments
 */
// Get user-specific appointments
router.get('/appointments', auth(['user']), userController.getUserAppointments);

/**
 * @swagger
 * /user/{userId}/block:
 *   put:
 *     summary: Block or unblock a user (admin only)
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isBlocked:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: User block status updated
 *       400:
 *         description: Invalid input
 *       404:
 *         description: User not found
 */
// Block or unblock a user (admin only, add auth middleware as needed)
router.put('/:userId/block', auth('admin'), updateBlockStatus);

// Get user's test bookings
router.get('/tests', auth(['user']), userController.getUserTests);

router.get('/opds-bookings', auth(['user']), userController.getUserOpdsBookings);

// Cancel OPDS appointment
router.put('/cancel-opds/:appointmentId', auth(['user']), userController.cancelOpdsAppointment);

module.exports = router;
