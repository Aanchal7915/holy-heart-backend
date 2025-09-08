const DoctorSlot = require('../models/DoctorSlot');
const Appointment = require('../models/Appointment');
const Service = require('../models/Service');
const User = require('../models/User');

// Utility to get day name from a date
function getDayName(date) {
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()];
}

// Controller to get OPDS service and next 14 days slot status for a doctor
exports.getDoctorOpdsSchedule = async (req, res) => {
    try {
        const doctorId = req.params.doctorId;

        // Get doctor details
        const doctor = await User.findById(doctorId).select('-password');
        if (!doctor) {
            return res.status(404).json({ error: 'Doctor not found' });
        }

        // Find DoctorSlot and populate services and slots
        const doctorSlot = await DoctorSlot.findOne({ doctor: doctorId })
            .populate('services.service', 'name type')
            .populate('weeklyAvailability.slots.service', 'name type');

        if (!doctorSlot) {
            return res.status(404).json({ error: 'DoctorSlot not found' });
        }

        // Find OPDS service from doctor's services
        const opdsService = doctorSlot.services.find(s => s.service.type === 'opds');
        if (!opdsService) {
            return res.status(404).json({ error: 'Doctor does not serve OPDS' });
        }

        // Get all OPDS appointments for next 14 days
        const today = new Date();
        const endDate = new Date();
        endDate.setDate(today.getDate() + 13);
        const appointments = await Appointment.find({
            doctor: doctorId,
            service: opdsService.service._id,
            start: { $gte: today, $lte: endDate }
        }).populate('patient', 'name email');

        // Build schedule for next 14 days
        const schedule = [];
        for (let i = 0; i < 14; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            const dayName = getDayName(date);

            // Find slots for this day for OPDS service only
            const dayAvailability = doctorSlot.weeklyAvailability.find(d => d.day === dayName);
            const slots = [];
            if (dayAvailability) {
                for (const slot of dayAvailability.slots) {
                    if (!slot.service || slot.service.type !== 'opds') continue;

                    // Build slot start/end datetime for this date
                    const [startHour, startMin] = slot.start.split(':').map(Number);
                    const [endHour, endMin] = slot.end.split(':').map(Number);
                    const slotStart = new Date(date);
                    slotStart.setHours(startHour, startMin, 0, 0);
                    const slotEnd = new Date(date);
                    slotEnd.setHours(endHour, endMin, 0, 0);

                    // Find if slot is booked
                    const booked = appointments.find(app =>
                        app.start.getTime() === slotStart.getTime() &&
                        app.end.getTime() === slotEnd.getTime()
                    );

                    slots.push({
                        start: slotStart,
                        end: slotEnd,
                        status: booked ? 'booked' : 'free',
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

        res.status(200).json({
            doctor: {
                id: doctor._id,
                name: doctor.name,
                email: doctor.email,
                phoneNu: doctor.phoneNu,
                gender: doctor.gender,
                image: doctor.image,
                address: doctor.address,
                role: doctor.role
            },
            opdsService: {
                id: opdsService.service._id,
                name: opdsService.service.name,
                chargePerAppointment: opdsService.chargePerAppointment
            },
            schedule
        });
    } catch (error) {
        console.error('getDoctorOpdsSchedule:', error);
        res.status(500).json({ error: 'Failed to fetch OPDS schedule', details: error.message });
    }
};

exports.getDoctorsServingOpds = async (req, res) => {
    try {
        // Find all DoctorSlot documents where OPDS service is assigned
        const doctorSlots = await DoctorSlot.find()
            .populate('doctor', '-password')
            .populate('services.service', 'name type');

        // Filter doctors who have OPDS service
        const doctors = doctorSlots
            .filter(ds => ds.services.some(s => s.service && s.service.type === 'opds'))
            .map(ds => ({
                id: ds.doctor._id,
                name: ds.doctor.name,
                email: ds.doctor.email,
                phoneNu: ds.doctor.phoneNu,
                gender: ds.doctor.gender,
                image: ds.doctor.image,
                address: ds.doctor.address,
                role: ds.doctor.role,
                opdsService: ds.services.find(s => s.service && s.service.type === 'opds')?.service?.name || null
            }));

        res.status(200).json({ doctors });
    } catch (error) {
        console.error('getDoctorsServingOpds:', error);
        res.status(500).json({ error: 'Failed to fetch doctors serving OPDS', details: error.message });
    }
};



