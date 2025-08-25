const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// User analytics
router.get('/users/summary', adminController.getUserSummary);

// Appointment analytics
router.get('/appointments/summary', adminController.getAppointmentSummary);
router.get('/appointments/trends', adminController.getAppointmentTrends);
router.get('/appointments/popular-services', adminController.getPopularServices);
router.get('/appointments/patient-ranking', adminController.getPatientRanking);

module.exports = router;
