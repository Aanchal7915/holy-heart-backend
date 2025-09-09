const User = require('../models/User');
const DoctorSlot = require('../models/DoctorSlot'); // Make sure you have a Slot model
const removeFile = require('../utils/removeFile');
const Service = require('../models/Service');
const bcrypt = require('bcrypt');
const Appointment = require('../models/Appointment');// If you have a separate model for tests

exports.addDoctor = async (req, res) => {
    try {
        const { name, email, password, phoneNu, gender } = req.body;
        if (!name || !email || !password || !gender) {
            return res.status(400).json({ error: 'Name, gender, email, and password are required' });
        }
        if(!req.file){
            return res.status(400).json({ error: 'Image file is required' });
        }

        // Check if doctor already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Doctor with this email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        // Create doctor user
        const doctor = new User({
            name,
            email,
            password: hashedPassword,
            phoneNu,
            role: 'doctor',
            isVerified: true,
            image:`${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`
        });
        await doctor.save();

        // Generate verification token
        // Send verification email

        res.status(201).json({ message: 'Doctor added successfully!', doctorId: doctor._id });
    } catch (error) {
        console.error('DoctorController - addDoctor:', error);
        res.status(500).json({ error: 'Failed to add doctor', details: error.message });
    }
};

// Get all doctors
exports.getAllDoctors = async (req, res) => {
    try {
        // You can add filters or pagination as needed
        const doctors = await User.find({ role: 'doctor' }).select('-password');
        res.status(200).json({ doctors });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch doctors', details: error.message });
    }
};

// Update doctor details
exports.updateDoctor = async (req, res) => {
    try {
        const { id } = req.params;
        let { name, gender, phoneNu, address } = req.body;

        const updates = {};
        if (name) updates.name = name;
        if (gender) updates.gender = gender;
        if (phoneNu) updates.phoneNu = phoneNu;
        if (address) updates.address = address;

        if (req.file) {
            // Find the doctor to get the old image
            const doctor = await User.findOne({ _id: id, role: 'doctor' });
            if (doctor && doctor.image) {
                // Extract filename from URL
                const filename = doctor.image.split('/').pop();
                removeFile(filename);
            }
            updates.image = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
        }

        //TODO: if doctor is marked inactive, active, deleted accordingly update corresponding doctorslot and appointments if needed

        

        const doctor = await User.findOneAndUpdate(
            { _id: id, role: 'doctor' },
            updates,
            { new: true, runValidators: true }
        ).select('-password');

        if (!doctor) {
            return res.status(404).json({ error: 'Doctor not found' });
        }

        res.status(200).json({ message: 'Doctor updated successfully', doctor });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update doctor', details: error.message });
    }
};

// Delete doctor (soft delete: mark as deleted)
exports.deleteDoctor = async (req, res) => {
    try {
        const { id } = req.params;

        const doctor = await User.findOneAndUpdate(
            { _id: id, role: 'doctor' },
            { isDeleted: true },
            { new: true }
        ).select('-password');

        if (!doctor) {
            return res.status(404).json({ error: 'Doctor not found' });
        }

        res.status(200).json({ message: 'Doctor deleted (soft delete) successfully', doctor });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete doctor', details: error.message });
    }
};

// Add one or more slots for a doctor, checking for overlap, service validity, and time logic
exports.addSlots = async (req, res) => {
    try {
        const { doctorId } = req.params;
        const { day, start, end, service } = req.body;
        if (!day || !start || !end || !service) {
            return res.status(400).json({ error: 'day, start, end, and service are required' });
        }

        // Check that start time is less than end time
        if (start >= end) {
            return res.status(400).json({ error: 'Start time must be less than end time' });
        }

        // Find DoctorSlot for this doctor
        let doctorSlot = await DoctorSlot.findOne({ doctor: doctorId });
        if (!doctorSlot) {
            return res.status(404).json({ error: 'DoctorSlot not found for this doctor. Assign service first.' });
        }

        // Check if the service exists in doctor's assigned services
        const assignedService = doctorSlot.services.find(
            s => String(s.service) === String(service)
        );
        if (!assignedService) {
            return res.status(400).json({ error: 'Service not assigned to this doctor. Assign the service first.' });
        }

        // Use chargePerAppointment from assigned service
        const chargePerAppointment = assignedService.chargePerAppointment;

        const slot = { start, end, service, chargePerAppointment };

        // Find the day's availability
        let dayAvailability = doctorSlot.weeklyAvailability.find(d => d.day === day);
        if (!dayAvailability) {
            dayAvailability = { day, slots: [slot] };
            doctorSlot.weeklyAvailability.push(dayAvailability);
        } else {
            const overlap = dayAvailability.slots.some(existingSlot =>
                (slot.start < existingSlot.end) &&
                (slot.end > existingSlot.start) &&
                (String(slot.service) === String(existingSlot.service))
            );
            if (overlap) {
                return res.status(400).json({ error: 'Slot overlaps with existing slot', slot: slot });
            }
            // Add slot
            dayAvailability.slots.push(slot);
        }

        await doctorSlot.save();
        res.status(201).json({ message: 'Slot added successfully', doctorSlot });
    } catch (error) {
        res.status(500).json({ error: 'Failed to add slot', details: error.message });
    }
};

// Edit a slot
exports.updateSlot = async (req, res) => {
    try {
        const { slotId } = req.params;
        const { startTime, endTime } = req.body;

        const slot = await DoctorSlot.findById(slotId);
        if (!slot) {
            return res.status(404).json({ error: 'Slot not found' });
        }

        // Check for overlap with other slots
        const overlap = await DoctorSlot.findOne({
            doctorId: slot.doctorId,
            _id: { $ne: slotId },
            $or: [
                {
                    startTime: { $lt: endTime },
                    endTime: { $gt: startTime }
                }
            ]
        });
        if (overlap) {
            return res.status(400).json({ error: 'Updated slot overlaps with existing slot' });
        }

        slot.startTime = startTime;
        slot.endTime = endTime;
        await slot.save();

        res.status(200).json({ message: 'Slot updated successfully', slot });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update slot', details: error.message });
    }
};

// Delete a slot from a doctor's weeklyAvailability
exports.deleteSlot = async (req, res) => {
    try {
        const {doctorId}=req.params;
        const { day, slotId } = req.body;

        // Find the DoctorSlot document for the doctor
        const doctorSlot = await DoctorSlot.findOne({ doctor: doctorId });
        if (!doctorSlot) {
            return res.status(404).json({ error: 'DoctorSlot not found' });
        }

        // Find the day's availability
        const dayAvailability = doctorSlot.weeklyAvailability.find(d => d.day === day);
        if (!dayAvailability) {
            return res.status(404).json({ error: 'Day not found in weeklyAvailability' });
        }

        // Find the slot index
        const slotIndex = dayAvailability.slots.findIndex(s => s._id.toString() === slotId);
        if (slotIndex === -1) {
            return res.status(404).json({ error: 'Slot not found' });
        }

        // Remove the slot
        dayAvailability.slots.splice(slotIndex, 1);

        await doctorSlot.save();
        res.status(200).json({ message: 'Slot deleted successfully', doctorSlot });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete slot', details: error.message });
    }
};

// Get all slots of a doctor
exports.getAllSlotsOfDoctor = async (req, res) => {
    try {
        const { doctorId } = req.params;
        if (!doctorId) {
            return res.status(400).json({ error: 'doctorId is required' });
        }

        const slots = await DoctorSlot.findOne({ doctor: doctorId })
            .populate("services.service") // populate top-level services
            .populate("weeklyAvailability.slots.service"); // populate nested slot services;

        res.status(200).json({ slots });
    } catch (error) {
        console.error('DoctorController - getAllSlotsOfDoctor:', error);
        res.status(500).json({ error: 'Failed to fetch slots', details: error.message });
    }
};

// Assign (append) a service to a doctor in DoctorSlot
exports.assignServiceToDoctor = async (req, res) => {
    try {
        const { doctorId } = req.params;
        const { service, chargePerAppointment } = req.body;

        if (!service) {
            return res.status(400).json({ error: 'service and chargePerAppointment are required' });
        }

        const serviceExists = await Service.findById(service);
        if (!serviceExists) {
            return res.status(404).json({ error: 'Service does not exist' });
        }

        // Find or create DoctorSlot for this doctor
        let doctorSlot = await DoctorSlot.findOne({ doctor: doctorId });
        if (!doctorSlot) {
            doctorSlot = new DoctorSlot({ doctor: doctorId, services: [], weeklyAvailability: [] });
        }

        // Check if service already assigned
        const alreadyAssigned = doctorSlot.services.some(
            s => String(s.service) === String(service)
        );
        if (alreadyAssigned) {
            return res.status(400).json({ error: 'Service already assigned to this doctor' });
        }

        // Append the service
        doctorSlot.services.push({ service, chargePerAppointment:serviceExists.price });
        await doctorSlot.save();

        res.status(200).json({ message: 'Service assigned to doctor successfully', doctorSlot });
    } catch (error) {
        console.error('DoctorController - assignServiceToDoctor:', error);
        res.status(500).json({ error: 'Failed to assign service', details: error.message });
    }
};

// Delete (remove) a service from a doctor's services array in DoctorSlot
exports.deleteServiceFromDoctor = async (req, res) => {
    try {
        const { doctorId } = req.params;
        const { serviceId } = req.body;

        if (!serviceId) {
            return res.status(400).json({ error: 'serviceId is required' });
        }

        // Find the DoctorSlot document for the doctor
        const doctorSlot = await DoctorSlot.findOne({ doctor: doctorId });
        if (!doctorSlot) {
            return res.status(404).json({ error: 'DoctorSlot not found' });
        }

        // Find the index of the service to remove
        const serviceIndex = doctorSlot.services.findIndex(
            s => String(s.service) === String(serviceId)
        );
        if (serviceIndex === -1) {
            return res.status(404).json({ error: 'Service not found in doctor\'s services' });
        }

        // Remove the service
        doctorSlot.services.splice(serviceIndex, 1);

        await doctorSlot.save();
        res.status(200).json({ message: 'Service removed from doctor successfully', doctorSlot });
    } catch (error) {
        res.status(500).json({ error: 'Failed to remove service', details: error.message });
    }
};

// Upload multiple images for an appointment
exports.uploadAppointmentImages = async (req, res) => {
    try {
        // console.log("reached...")
        const { appointmentId } = req.params;
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No images uploaded' });
        }

        // Get image URLs
        const imageUrls = req.files.map(file =>
            `${req.protocol}://${req.get("host")}/uploads/${file.filename}`
        );

        // Update appointment with new images (append if already exist)
        const appointment = await Appointment.findById(appointmentId);
        if (!appointment) {
            return res.status(404).json({ error: 'Appointment not found' });
        }

        if (!appointment.images) appointment.images = [];
        appointment.images.push(...imageUrls);
        await appointment.save();

        res.status(200).json({ message: 'Images uploaded successfully', images: appointment.images });
    } catch (error) {
        res.status(500).json({ error: 'Failed to upload images', details: error.message });
    }
};

// Delete an image from an appointment
exports.deleteAppointmentImage = async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const { pdfUrl } = req.body;
        if (!pdfUrl) {
            return res.status(400).json({ error: 'pdfUrl is required' });
        }

        const appointment = await Appointment.findById(appointmentId);
        if (!appointment) {
            return res.status(404).json({ error: 'Appointment not found' });
        }

        // Remove image from array
        const pdfIndex = appointment.images.findIndex(url => url === pdfUrl);
        if (pdfIndex === -1) {
            return res.status(404).json({ error: 'Pdf not found in appointment' });
        }

        appointment.images.splice(pdfIndex, 1);
        await appointment.save();

        // Remove file from uploads folder
        const filename = pdfUrl.split('/').pop();
        removeFile(filename);

        res.status(200).json({ message: 'Pdf deleted successfully', images: appointment.images });
    } catch (error) {
        console.error('DoctorController - deleteAppointmentImage:', error);
        res.status(500).json({ error: 'Failed to delete pdf', details: error.message });
    }
};

// Get all appointments for a doctor (type: treatment)
exports.getDoctorAppointments = async (req, res) => {
    try {
        // console.log("doctor: ", req.user);
        const doctorId = req.user.userId; // assuming doctor is authenticated
        // Find appointments where the service type is 'treatment'
        const appointments = await Appointment.find({ doctor: doctorId })
            .populate({
                path: 'service',
                match: { type: 'treatment' },
                select: 'name type'
            })
            .populate('patient', 'name email gender phoneNu')
            .sort({ start: -1 });

        // Filter out appointments where service is null (not treatment)
        const filtered = appointments.filter(a => a.service);

        res.status(200).json({ appointments: filtered });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch appointments', details: error.message });
    }
};

// Get all test bookings for a doctor (type: test)
exports.getDoctorTestBookings = async (req, res) => {
    try {
        const doctorId = req.user.userId;
        // Find appointments where the service type is 'test'
        const tests = await Appointment.find({ doctor: doctorId })
            .populate({
                path: 'service',
                match: { type: 'test' },
                select: 'name type'
            })
            .populate('patient', 'name email')
            .sort({ start: -1 });

        // Filter out appointments where service is null (not test)
        const filtered = tests.filter(a => a.service);

        res.status(200).json({ testBookings: filtered });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch test bookings', details: error.message });
    }
};

// Unified endpoint with filter: ?type=test or ?type=treatment
exports.getDoctorRecords = async (req, res) => {
    try {
        const doctorId = req.user.userId;
        const { type } = req.query; // type: 'test' or 'treatment'
        let records = await Appointment.find({ doctor: doctorId })
            .populate({
                path: 'service',
                match: type ? { type } : {},
                select: 'name type'
            })
            .populate('patient', 'name email')
            .sort({ start: -1 });

        // If type is specified, filter out appointments where service is null
        if (type) {
            records = records.filter(a => a.service);
        }

        res.status(200).json({ records });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch records', details: error.message });
    }
};


