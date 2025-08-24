const Appointment = require('../models/Appointment'); // Adjust path if needed

exports.bookAppointment = async (req, res) => {
    try {
        let {
            patientName,
            patientEmail,
            patientPhone,
            appointmentDate,
            Message,
            serviceType,
            status
        } = req.body;

        // Convert 'DD-MM-YYYY' to 'YYYY-MM-DD'
        if (appointmentDate && typeof appointmentDate === 'string') {
            const [day, month, year] = appointmentDate.split('-');
            appointmentDate = new Date(`${year}-${month}-${day}`);
        }


        const appointment = new Appointment({
            patientId: req.user.userId, // Add patientId from authorized user
            patientName,
            patientEmail,
            patientPhone,
            appointmentDate,
            Message,
            serviceType,
            status
        });

        await appointment.save();
        res.status(201).json({ message: 'Appointment booked successfully', appointment });
    } catch (error) {
        res.status(500).json({ error: 'Failed to book appointment', details: error.message });
    }
}


exports.getAppointments = async (req, res) => {
    try {
        // Filtering
        const { appointmentDate, status, serviceType, sort = 'desc', page = 1, limit = 10 } = req.query;
        const filter = {};
        if (appointmentDate) {
            // Accepts 'YYYY-MM-DD' or 'DD-MM-YYYY'
            let dateObj;
            if (/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) {
                dateObj = new Date(appointmentDate);
            } else if (/^\d{2}-\d{2}-\d{4}$/.test(appointmentDate)) {
                const [day, month, year] = appointmentDate.split('-');
                dateObj = new Date(`${year}-${month}-${day}`);
            }
            if (dateObj) {
                // Filter for the whole day
                const start = new Date(dateObj.setHours(0,0,0,0));
                const end = new Date(dateObj.setHours(23,59,59,999));
                filter.appointmentDate = { $gte: start, $lte: end };
            }
        }
        if (status) filter.status = status;
        if (serviceType) filter.serviceType = serviceType;

        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Sorting
        const sortOrder = sort === 'asc' ? 1 : -1;

        const appointments = await Appointment.find(filter)
            .sort({ appointmentDate: sortOrder })
            .skip(skip)
            .limit(parseInt(limit));

        // Total count for pagination
        const total = await Appointment.countDocuments(filter);

        res.status(200).json({
            appointments,
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / parseInt(limit))
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch appointments', details: error.message });
    }
}

exports.updateAppointmentStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        // Validate status
        const validStatuses = ['Pending', 'Confirmed', 'Cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status value' });
        }
        const appointment = await Appointment.findByIdAndUpdate(
            id,
            { status },
            { new: true }
        );
        if (!appointment) {
            return res.status(404).json({ error: 'Appointment not found' });
        }
        res.status(200).json({ message: 'Appointment status updated', appointment });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update appointment status', details: error.message });
    }
};