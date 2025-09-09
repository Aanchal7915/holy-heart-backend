const DoctorSlot = require('../models/DoctorSlot');
const Appointment = require('../models/Appointment');
const Service = require('../models/Service');
const User = require('../models/User');

// Utility to get day name from a date
function getDayName(date) {
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()];
}

function withCustomTime(date, hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    const d = new Date(date); // copy the date
    d.setHours(h, m, 0, 0);   // set custom hours & minutes
    return d.toLocaleString("en-GB", { hour12: false });
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
            status: { $nin: ['cancelled', 'expired'] },
            start: { $gte: today, $lte: endDate }
        });
        console.log("appointments", appointments)

        // Build schedule for next 14 days
        const schedule = [];
        for (let i = 0; i < 14; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            const dayName = getDayName(date);
            console.log("start...................................")
            // Find slots for this day for OPDS service only
            console.log("dayName", dayName)
            console.log(date.toLocaleString("en-GB"));
            const dayAvailability = doctorSlot.weeklyAvailability.find(d => d.day === dayName);
            console.log("dayAvailability", dayAvailability)
            const slots = [];
            if (dayAvailability) {
                for (const slot of dayAvailability.slots) {
                    if (!slot.service || slot.service.type !== 'opds') continue;

                    // Build slot start/end datetime for this date
                    console.log(".........")

                    const [startHour, startMin] = slot.start.split(':').map(Number);
                    const [endHour, endMin] = slot.end.split(':').map(Number);
                    const slotStart = new Date(date);
                    slotStart.setHours(startHour, startMin, 0, 0);
                    const slotEnd = new Date(date);
                    slotEnd.setHours(endHour, endMin, 0, 0);

                    console.log(slotStart.toLocaleString("en-GB"), slotEnd.toLocaleString("en-GB"))


                    // Find if slot is booked
                    console.log("Find if slot is booked")
                    const booked = appointments.find(app => {
                        console.log(app.start.toLocaleString("en-GB"), app.end.toLocaleString("en-GB"))
                        return app.start.getTime() === slotStart.getTime() && app.end.getTime() === slotEnd.getTime()
                    }
                    );
                    console.log("booked", booked)

                    slots.push({
                        start: slot.start,
                        end: slot.end,
                        status: booked ? 'booked' : 'free',
                        appointment: booked ? {
                            patient: booked.patient,
                            status: booked.status,
                            appointmentId: booked._id
                        } : null
                    });
                }
            }

           
            const [day, month, year] = date.toLocaleString("en-GB").split(',')[0].split('/');
            const formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            // console.log("adding for",formattedDate); // e.g., "2025-09-09"


            schedule.push({
                date: formattedDate, // YYYY-MM-DD
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

exports.bookOpdsAppointment = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { doctorId, date, start, end } = req.body;

        if (!doctorId || !date || !start || !end) {
            return res.status(400).json({ error: 'doctorId, date, start, and end are required.' });
        }

        // Find OPDS service
        const opdsService = await Service.findOne({ type: "opds" });
        if (!opdsService) {
            return res.status(400).json({ error: 'OPDS service not found.' });
        }
        const serviceId = opdsService._id.toString();

        // Find doctor slot and verify OPDS service is assigned
        const doctorSlot = await DoctorSlot.findOne({ doctor: doctorId })
            .populate('services.service', 'type')
            .populate('weeklyAvailability.slots.service', 'type');
        if (!doctorSlot) {
            return res.status(400).json({ error: 'DoctorSlot not found.' });
        }
        const hasOpdsService = doctorSlot.services.some(s => s.service && s.service._id.toString() === serviceId && s.service.type === 'opds');
        if (!hasOpdsService) {
            return res.status(400).json({ error: 'Doctor does not serve OPDS.' });
        }

        // Get day name for the booking date
        const bookingDate = new Date(date);
        // console.log("bookingDate", bookingDate.toLocaleString("en-GB"))
        const dayName = getDayName(bookingDate);

        // Find the slot in weeklyAvailability for OPDS service
        const dayAvailability = doctorSlot.weeklyAvailability.find(d => d.day === dayName);
        if (!dayAvailability) {
            return res.status(400).json({ error: 'Doctor does not provide slots on this day.' });
        }

        // Find the exact slot for OPDS service, start, and end
        const slot = dayAvailability.slots.find(s =>
            s.service &&
            s.service._id.toString() === serviceId &&
            s.start === start &&
            s.end === end
        );
        if (!slot) {
            return res.status(400).json({ error: 'Requested slot is not available for OPDS service.' });
        }

        // Build slot start/end datetime for this date
        const [startHour, startMin] = start.split(':').map(Number);
        const [endHour, endMin] = end.split(':').map(Number);
        const slotStart = new Date(bookingDate);
        slotStart.setHours(startHour, startMin, 0, 0);
        const slotEnd = new Date(bookingDate);
        slotEnd.setHours(endHour, endMin, 0, 0);

        // Check if slot is already booked
        const existing = await Appointment.findOne({
            doctor: doctorId,
            service: serviceId,
            start: slotStart,
            end: slotEnd,
            status: { $nin: ['cancelled', 'expired'] }
        });
        if (existing) {
            return res.status(409).json({ error: 'This OPDS slot is already booked.' });
        }

        // Book the appointment
        const appointment = new Appointment({
            doctor: doctorId,
            patient: userId,
            service: serviceId,
            start: slotStart,
            end: slotEnd,
            charge: slot.chargePerAppointment,
            status: 'reserved'
        });
        await appointment.save();

        res.status(201).json({ message: 'OPDS appointment booked successfully', appointment });
    } catch (error) {
        console.error('bookOpdsAppointment:', error);
        res.status(500).json({ error: 'Failed to book OPDS appointment', details: error.message });
    }
};

exports.getDoctorOpdsAppointments = async (req, res) => {
    try {
        const doctorId = req.user.userId;

        // Find OPDS service id
        const opdsService = await Service.findOne({ type: "opds" });
        if (!opdsService) {
            return res.status(404).json({ error: 'OPDS service not found.' });
        }

        // Fetch all OPDS appointments for this doctor
        const appointments = await Appointment.find({
            doctor: doctorId,
            service: opdsService._id
        })
        .populate('patient', 'name email phoneNu')
        .sort({ start: -1 });

        res.status(200).json({ appointments });
    } catch (error) {
        console.error('getDoctorOpdsAppointments:', error);
        res.status(500).json({ error: 'Failed to fetch OPDS appointments', details: error.message });
    }
};
