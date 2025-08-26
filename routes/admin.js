const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin');
const { auth } = require('../middleware/auth');

/**

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Admin operations
 */

/**
 * @swagger
 * /admin/users/summary:
 *   get:
 *     summary: Get user analytics summary
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User analytics summary
 */
// User analytics
router.get('/users/summary', auth('admin') ,adminController.getUserSummary);

/**
 * @swagger
 * /admin/appointments/summary:
 *   get:
 *     summary: Get appointment analytics summary
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Appointment analytics summary
 */
// Appointment analytics
router.get('/appointments/summary', auth('admin'), adminController.getAppointmentSummary);

/**
 * @swagger
 * /admin/appointments/trends:
 *   get:
 *     summary: Get appointment trends
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Appointment trends
 */
router.get('/appointments/trends', auth('admin'), adminController.getAppointmentTrends);

/**
 * @swagger
 * /admin/appointments/popular-services:
 *   get:
 *     summary: Get popular appointment services
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Popular appointment services
 */
router.get('/appointments/popular-services', auth('admin'), adminController.getPopularServices);

/**
 * @swagger
 * /admin/appointments/patient-ranking:
 *   get:
 *     summary: Get patient ranking
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Patient ranking
 */
router.get('/appointments/patient-ranking', auth('admin'), adminController.getPatientRanking);

module.exports = router;
