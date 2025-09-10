const Razorpay = require('razorpay');
const User = require('../models/User');
const TestBooking = require('../models/TestBooking');
const Service = require('../models/Service');
const crypto = require('crypto');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

exports.createOrder = async (req, res) => {
    try {
        const { amount, currency, receipt, testId } = req.body;
        const userId = req.user.userId;
        console.log(req.user)
        console.log(amount, currency, receipt, testId)
        if (!amount || !currency || !receipt || !testId) {
            return res.status(400).json({ error: 'amount, currency, receipt, and testId are required' });
        }

        // Get user details
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get test/service details
        const test = await Service.findById(testId);
        if (!test) {
            return res.status(404).json({ error: 'Test not found' });
        }

        // Prepare notes
        const notes = {
            testId: test._id.toString(),
            testName: test.name,
            userId: user._id.toString(),
        };

        const options = {
            amount: parseInt(test.price) * 100, // amount in paise
            currency,
            receipt,
            notes,
        };

        const order = await razorpay.orders.create(options);

        res.status(200).json(order);
    } catch (error) {
        console.error('Error creating Razorpay order:', error);
        res.status(500).json({ error: 'Failed to create order', details: error.message });
    }
};

exports.verifyPayment = async (req, res) => {
    try {
        const webhookSignature = req.headers["x-razorpay-signature"];
        const body = JSON.stringify(req.body);

        const RAZORPAY_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;
        const expectedSignature = crypto
            .createHmac("sha256", RAZORPAY_SECRET)
            .update(body)
            .digest("hex");

        if (expectedSignature === webhookSignature) {
            if (req.body.event === "payment.captured") {
                const payment = req.body.payload.payment.entity;

                // Create booking only on success
                const booking = new TestBooking({
                    patient: payment.notes.userId, // frontend should pass these via notes
                    name: payment.notes.name,
                    email: payment.notes.email,
                    phoneNu: payment.notes.phoneNu,
                    gender: payment.notes.gender,
                    test: payment.notes.testId,
                    razorpayOrderId: payment.order_id,
                    razorpayPaymentId: payment.id,
                    razorpaySignature: webhookSignature,
                    amount: payment.amount/100,
                    currency: payment.currency,
                    status: "captured",
                    method: payment.method,
                    capturedAt: new Date(),
                    paymentDetails: {
                        cardLast4: payment.card?.last4,
                        cardNetwork: payment.card?.network,
                        upiId: payment.acquirer_data?.upi_transaction_id,
                        wallet: payment.wallet,
                        bank: payment.bank,
                    },
                });

                await booking.save();
                console.log("✅ Booking created after successful payment");
            }
            return res.status(200).json({ status: "ok" });
        } else {
            console.error("Webhook verification failed ❌");
            return res.status(400).json({ status: "failed" });
        }
    } catch (error) {
        console.error("Webhook Error:", error);
        return res.status(500).json({ error: error.message });
    }
};