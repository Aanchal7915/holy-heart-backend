const express = require('express');
const router = express.Router();
const opdsController = require('../controllers/opds');
const { auth } = require('../middleware/auth');

// Get OPDS service and next 14 days slot status for a doctor
router.get('/:doctorId/schedule-opd', opdsController.getDoctorOpdsSchedule);
router.get('/doctor/', opdsController.getDoctorsServingOpds);
module.exports = router;