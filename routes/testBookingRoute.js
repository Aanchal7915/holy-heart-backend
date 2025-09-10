const express = require("express");
const { getAllTestBookings, getUserTestBookings, uploadReport, deleteReport } = require("../controllers/testBooking");
const { auth } = require('../middleware/auth');
const upload = require('../utils/fileUpload');

const router = express.Router();

// Admin route for fetching all test bookings
router.get("/", getAllTestBookings);

router.get("/my-bookings", auth(['user']), getUserTestBookings);

// Delete appointment report
router.delete('/:testId/delete-pdf', auth(['doctor', 'admin', 'user']),
    deleteReport
);

router.post(
    '/:testId/upload-pdf',
    auth(['admin', 'doctor']),
    upload.single('pdf'), // 'images' is the field name, max 10 files
    uploadReport
);

module.exports = router;
