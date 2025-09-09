const User = require('../models/User');
const Appointment = require('../models/Appointment');
const DoctorSlot = require('../models/DoctorSlot');
const Service = require('../models/Service');

// Utility to get day name from a date
function getDayName(date) {
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()];
}

// Utility to format slot status
function formatSlotStatus(slot, bookedAppointments) {
    // Find if slot is booked for this time and service
    const booked = bookedAppointments.find(app =>
        app.service.toString() === slot.service.toString() &&
        app.start.getHours() === parseInt(slot.start.split(':')[0]) &&
        app.start.getMinutes() === parseInt(slot.start.split(':')[1])
    );
    return {
        ...slot,
        status: booked ? 'booked' : 'empty',
        appointment: booked ? {
            patient: booked.patient,
            start: booked.start,
            end: booked.end,
            status: booked.status
        } : null
    };
}

// Controller to get next 40 days schedule for a doctor
exports.getDoctorSchedule = async (req, res) => {
    try {
        const doctorId = req.params.doctorId;

        // Get doctor's slot structure
        const doctorSlot = await DoctorSlot.findOne({ doctor: doctorId })
            .populate('services.service', 'name type')
            .populate('weeklyAvailability.slots.service', 'name type');

        if (!doctorSlot) {
            return res.status(404).json({ error: 'DoctorSlot not found' });
        }

        // Get all appointments for next 40 days
        const today = new Date();
        const endDate = new Date();
        endDate.setDate(today.getDate() + 39);
        const appointments = await Appointment.find({
            doctor: doctorId,
            start: { $gte: today, $lte: endDate }
        }).populate('patient', 'name email');

        // Build schedule for next 40 days
        const schedule = [];
        for (let i = 0; i < 40; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            const dayName = getDayName(date);

            // Find slots for this day
            const dayAvailability = doctorSlot.weeklyAvailability.find(d => d.day === dayName);
            const slots = [];
            if (dayAvailability) {
                for (const slot of dayAvailability.slots) {
                    // Build slot start/end datetime for this date
                    const [startHour, startMin] = slot.start.split(':').map(Number);
                    const [endHour, endMin] = slot.end.split(':').map(Number);
                    const slotStart = new Date(date);
                    slotStart.setHours(startHour, startMin, 0, 0);
                    const slotEnd = new Date(date);
                    slotEnd.setHours(endHour, endMin, 0, 0);

                    // Find if slot is booked
                    const booked = appointments.find(app =>
                        app.service.toString() === slot.service._id.toString() &&
                        app.start.getTime() === slotStart.getTime() &&
                        app.end.getTime() === slotEnd.getTime()
                    );

                    slots.push({
                        service: slot.service,
                        start: slotStart,
                        end: slotEnd,
                        chargePerAppointment: slot.chargePerAppointment,
                        status: booked ? 'booked' : 'empty',
                        appointment: booked ? {
                            patient: booked.patient,
                            status: booked.status,
                            appointmentId: booked._id
                        } : null
                    });
                }
            }

            schedule.push({
                date: date.toISOString().slice(0, 10),
                day: dayName,
                slots
            });
        }

        res.status(200).json({ doctorId, schedule });
    } catch (error) {
        console.error('getDoctorSchedule:', error);
        res.status(500).json({ error: 'Failed to fetch doctor schedule', details: error.message });
    }
};

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

// Fetch user's OPDS bookings from Appointment model
exports.getUserOpdsBookings = async (req, res) => {
    try {
        const userId = req.user.userId;
        const today = new Date();
        const endDate = new Date();
        endDate.setDate(today.getDate() + 13);

        // Find appointments for this user where service type is 'opds', date in next 14 days, and status is not cancelled
        const appointments = await Appointment.find({
            patient: userId,
            start: { $gte: today, $lte: endDate },
            status: { $ne: 'cancelled' }
        })
        .populate({
            path: 'service',
            match: { type: 'opds' },
            select: 'name type'
        })
        .populate('doctor', 'name email phoneNu')
        .sort({ start: 1 });

        // Filter out appointments where service is null (not OPDS)
        const opdsBookings = appointments.filter(a => a.service);

        res.status(200).json({ opdsBookings });
    } catch (error) {
        console.error('UserController - getUserOpdsBookings:', error);
        res.status(500).json({ error: 'Failed to fetch user OPDS bookings', details: error.message });
    }
};



exports.cancelOpdsAppointment = async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const userId = req.user.userId;

        // Find the appointment and ensure it belongs to the user and is OPDS type
        const appointment = await Appointment.findById(appointmentId)
            .populate({
                path: 'service',
                match: { type: 'opds' },
                select: 'type'
            });

        if (!appointment || !appointment.service) {
            return res.status(404).json({ error: 'OPDS appointment not found.' });
        }

        if (appointment.patient.toString() !== userId) {
            return res.status(403).json({ error: 'You are not authorized to cancel this appointment.' });
        }

        if (appointment.status === 'cancelled') {
            return res.status(400).json({ error: 'Appointment is already cancelled.' });
        }

        appointment.status = 'cancelled';
        await appointment.save();

        res.status(200).json({ message: 'OPDS appointment cancelled successfully', appointment });
    } catch (error) {
        console.error('cancelOpdsAppointment:', error);
        res.status(500).json({ error: 'Failed to cancel OPDS appointment', details: error.message });
    }
};





