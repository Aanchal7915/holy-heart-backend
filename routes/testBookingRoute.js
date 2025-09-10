const express = require("express");
const { getAllTestBookings, getUserTestBookings } = require("../controllers/testBooking");
const { auth } = require('../middleware/auth');

const router = express.Router();

// Admin route for fetching all test bookings
router.get("/test-bookings", getAllTestBookings);

router.get("/my-bookings", auth(['user']), getUserTestBookings);

module.exports = router;
