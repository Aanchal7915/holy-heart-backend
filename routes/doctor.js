const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctor');
const appointmentController = require('../controllers/appointment');
const { auth } = require('../middleware/auth');
const upload = require('../utils/fileUpload');

// Add a new doctor (admin only)
router.post('/', auth(['admin']), upload.single('image'), doctorController.addDoctor);

// Get all doctors
router.get('/', auth(['admin']), doctorController.getAllDoctors);

// Update doctor details
router.put('/:id', auth(['admin']), upload.single('image'), doctorController.updateDoctor);

// Delete doctor (soft delete)
router.delete('/:id', auth(['admin']), doctorController.deleteDoctor);

// Add slots for a doctor
router.post('/slots/:doctorId', auth(['admin']), doctorController.addSlots);

// Update a slot
router.put('/slots/:slotId', auth(['admin']), doctorController.updateSlot);

// Delete a slot
router.delete('/slots/:doctorId', auth(['admin']), doctorController.deleteSlot);

// Get all slots of a doctor
router.get('/slots/:doctorId', auth(['admin', 'doctor']), doctorController.getAllSlotsOfDoctor);

// Assign a service to a doctor (append service)
router.post('/service/:doctorId', auth(['admin']), doctorController.assignServiceToDoctor)

// remove a service from a doctor
router.delete('/service/:doctorId', auth(['admin']), doctorController.deleteServiceFromDoctor);

// Upload multiple images for an appointment
router.post(
    '/appointments/:appointmentId/upload-pdf',
    auth(['admin', 'doctor', 'user']),
    upload.array('pdfs', 10), // 'images' is the field name, max 10 files
    doctorController.uploadAppointmentImages
);

// Get doctor's appointments
router.get('/appointments', auth(['doctor']), doctorController.getDoctorAppointments);

// Get doctor's test bookings
router.get('/test-bookings', auth(['doctor']), doctorController.getDoctorTestBookings);

// Unified endpoint with filter
router.get('/records', auth(['doctor']), doctorController.getDoctorRecords);

// Delete appointment image
router.delete('/appointments/:appointmentId/delete-pdf', auth(['doctor', 'admin', 'user']),
    doctorController.deleteAppointmentImage
);

module.exports = router;