const Razorpay = require('razorpay');
const User = require('../models/User');
const Service = require('../models/Service');

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
            return res.status(404).json({ error: 'Test/Service not found' });
        }

        // Prepare notes
        const notes = {
            testId: test._id.toString(),
            testName: test.name,
            userName: user.name,
            userEmail: user.email,
            userPhone: user.phoneNu || user.phone || '',
        };

        const options = {
            amount: parseInt(amount), // amount in paise
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