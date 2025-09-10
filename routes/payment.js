const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment');
const { auth } = require('../middleware/auth');

// Create Razorpay order
router.post('/create-order', auth(['user']), paymentController.createOrder);
router.post("/razorpay-webhook", paymentController.verifyPayment);

module.exports = router;