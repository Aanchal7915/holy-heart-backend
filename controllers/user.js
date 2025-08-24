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
        res.status(500).json({ error: 'Failed to fetch profile', details: error.message });
    }
};

exports.getAllUsers = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }
        const users = await User.find().select('-password');
        res.status(200).json({ users });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch users', details: error.message });
    }
};


exports.getUserAppointments = async (req, res) => {
    try {
        const { serviceType, status, appointmentDate, sort = 'desc', page = 1, limit = 10 } = req.query;
        const filter = { patientId: req.user.userId };
        if (serviceType) filter.serviceType = serviceType;
        if (status) filter.status = status;
        if (appointmentDate) {
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
                filter.appointmentDate = { $gte: start, $lte: end };
            }
        }
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const sortOrder = sort === 'asc' ? 1 : -1;
        const appointments = await Appointment.find(filter)
            .sort({ appointmentDate: sortOrder })
            .skip(skip)
            .limit(parseInt(limit));
        const total = await Appointment.countDocuments(filter);
        res.status(200).json({
            appointments,
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / parseInt(limit))
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch user appointments', details: error.message });
    }
};

