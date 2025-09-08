const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment');
const { auth } = require('../middleware/auth');

// Create Razorpay order
router.post('/create-order', auth(['user']), paymentController.createOrder);

module.exports = router;