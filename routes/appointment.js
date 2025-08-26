/**
 * @swagger
 * tags:
 *   name: Appointment
 *   description: Appointment management
 */

const express = require('express');
const { bookAppointment, getAppointments, updateAppointmentStatus } = require('../controllers/appointment');
const { auth } = require('../middleware/auth');


const route=express.Router();

/**
 * @swagger
 * /appointments:
 *   get:
 *     summary: Get all appointments (admin only, paginated)
 *     tags: [Appointment]
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
 *         description: List of appointments
 */
route.get('/', auth(['admin']), getAppointments);

/**
 * @swagger
 * /appointments:
 *   post:
 *     summary: Book a new appointment
 *     tags: [Appointment]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               serviceType:
 *                 type: string
 *               appointmentDate:
 *                 type: string
 *                 format: date-time
 *               status:
 *                 type: string
 *     responses:
 *       201:
 *         description: Appointment booked
 *       400:
 *         description: Invalid input
 */
route.post('/', auth(['user']), bookAppointment);

/**
 * @swagger
 * /appointments/{id}/status:
 *   put:
 *     summary: Update appointment status (admin only)
 *     tags: [Appointment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Appointment ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Appointment status updated
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Appointment not found
 */
route.put('/:id/status', auth(['admin']), updateAppointmentStatus);


module.exports=route;