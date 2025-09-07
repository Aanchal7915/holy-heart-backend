const User = require('../models/User');
const Appointment = require('../models/Appointment');

exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(200).json({ user });
    } catch (error) {
        console.error('UserController - getProfile:', error);
        res.status(500).json({ error: 'Failed to fetch profile', details: error.message });
    }
};

exports.getAllUsers = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }
        const { page = 1, limit = 10, email } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const filter = {};
        if (email) {
            filter.email = { $regex: email, $options: 'i' };
        }
        const users = await User.find(filter)
            .select('-password')
            .skip(skip)
            .limit(parseInt(limit));
        const total = await User.countDocuments(filter);
        res.status(200).json({
            users,
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / parseInt(limit))
        });
    } catch (error) {
        console.error('UserController - getAllUsers:', error);
        res.status(500).json({ error: 'Failed to fetch users', details: error.message });
    }
};


exports.getUserAppointments = async (req, res) => {
    try {
        const {
            serviceType,
            status,
            appointmentDate,
            startDate,
            endDate,
            sort = 'desc',
            page = 1,
            limit = 10
        } = req.query;
        const filter = { patient: req.user.userId };
        if (serviceType) filter.service = serviceType;
        if (status) filter.status = status;

        // Date range filtering
        if (startDate || endDate) {
            filter.start = {};
            if (startDate) {
                const start = new Date(startDate);
                start.setHours(0,0,0,0);
                filter.start.$gte = start;
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23,59,59,999);
                filter.start.$lte = end;
            }
        } else if (appointmentDate) {
            let dateObj;
            if (/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) {
                dateObj = new Date(appointmentDate);
            } else if (/^\d{2}-\d{2}-\d{4}$/.test(appointmentDate)) {
                const [day, month, year] = appointmentDate.split('-');
                dateObj = new Date(`${year}-${month}-${day}`);
            }
            if (dateObj) {
                const start = new Date(dateObj.setHours(0,0,0,0));
                const end = new Date(dateObj.setHours(23,59,59,999));
                filter.start = { $gte: start, $lte: end };
            }
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const sortOrder = sort === 'asc' ? 1 : -1;

        // Only fetch appointments where service.type === 'test'
        const appointments = await Appointment.find(filter)
            .sort({ start: sortOrder })
            .skip(skip)
            .limit(parseInt(limit))
            .populate({
                path: 'service',
                match: { type: 'treatment' },
                select: 'name description type'
            })
            .populate('doctor', 'name email phoneNu');

        // Filter out appointments where service is null (not a test)
        const tests = appointments.filter(a => a.service);

        const total = tests.length;
        res.status(200).json({
            appointments: tests,
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / parseInt(limit))
        });
    } catch (error) {
        console.error('UserController - getUserAppointments:', error);
        res.status(500).json({ error: 'Failed to fetch user appointments', details: error.message });
    }
};

exports.updateBlockStatus = async (req, res) => {
    try {
        if(!req.body) {
            return res.status(400).json({ error: 'Request body is missing' });
        }
        const { userId } = req.params;
        const { isBlocked } = req.body;
        console.log("req body:", req.body)

        if (typeof isBlocked !== 'boolean') {
            return res.status(400).json({ error: 'isBlocked must be a boolean' });
        }
        if(userId === req.user.userId) {
            return res.status(400).json({ error: 'You cannot block yourself' });
        }

        const user = await User.findByIdAndUpdate(
            userId,
            { isBlocked },
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.status(200).json({ message: `User ${isBlocked ? 'blocked' : 'unblocked'} successfully`, user });
    } catch (error) {
        console.error('UserController - updateBlockStatus:', error);
        res.status(500).json({ error: 'Server error', message: 'Failed to update block status' });
    }
};

// Fetch user's test bookings (appointments where service.type === 'test')
exports.getUserTests = async (req, res) => {
    try {
        const {
            status,
            startDate,
            endDate,
            sort = 'desc',
            page = 1,
            limit = 10
        } = req.query;

        const filter = { patient: req.user.userId };

        if (status) filter.status = status;

        // Date range filtering
        if (startDate || endDate) {
            filter.start = {};
            if (startDate) {
                const start = new Date(startDate);
                start.setHours(0,0,0,0);
                filter.start.$gte = start;
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23,59,59,999);
                filter.start.$lte = end;
            }
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const sortOrder = sort === 'asc' ? 1 : -1;

        // Find appointments and populate service, filter for type 'test'
        const appointments = await Appointment.find(filter)
            .sort({ start: sortOrder })
            .skip(skip)
            .limit(parseInt(limit))
            .populate({
                path: 'service',
                match: { type: 'test' },
                select: 'name description type'
            })
            .populate('doctor', 'name email phoneNu');

        // Filter out appointments where service is null (not a test)
        const tests = appointments.filter(a => a.service);

        const total = tests.length;
        res.status(200).json({
            tests,
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / parseInt(limit))
        });
    } catch (error) {
        console.error('UserController - getUserTests:', error);
        res.status(500).json({ error: 'Failed to fetch user tests', details: error.message });
    }
};