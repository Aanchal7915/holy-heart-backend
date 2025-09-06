const Service = require('../models/Service');
const Appointment = require('../models/Appointment');
const removeFile = require('../utils/removeFile');


// Add a new service
exports.addService = async (req, res) => {
    try {
        const { name, description } = req.body;
        console.log("body", req.body);
        if (!name || !description) {
            return res.status(400).json({ error: 'Name and description are required' });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'Image file is required' });
        }

        const service = new Service({ name, description, status: 'active', image: `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`});
        await service.save();
        res.status(201).json({ message: 'Service added successfully', service });
    } catch (error) {
        console.error('ServiceController - addService:', error);
        res.status(500).json({ error: 'Failed to add service', details: error.message });
    }
};

// Update a service
exports.updateService = async (req, res) => {
    try {
        console.log("req body:", req.body);
        const { id } = req.params;
        let {name, description, status} = req.body;
        updates = {};
        if (name) updates.name = name;
        if (description) updates.description = description;
        if(status) status=status.toLowerCase();
        if(status && ['active', 'inactive'].includes(status)) updates.status=status;

        
        if(req.file) updates.image=`${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;

        const service = await Service.findByIdAndUpdate(id, updates, { new: true });
        if (!service) {
            return res.status(404).json({ error: 'Service not found' });
        }
        res.status(200).json({ message: 'Service updated successfully', service });
    } catch (error) {
        console.error('ServiceController - updateService:', error);
        res.status(500).json({ error: 'Failed to update service', details: error.message });
    }
};


// Mark as deleted (soft delete)
exports.deleteService = async (req, res) => {
    try {
        const { id } = req.params;
        const service = await Service.findByIdAndUpdate(id, { status: "deleted" }, { new: true });
        if (!service) {
            return res.status(404).json({ error: 'Service not found' });
        }
        // Update related appointments to 'cancelled' or another status as needed
        await Appointment.updateMany({ serviceId: id }, { status: 'cancelled' });
        res.status(200).json({ message: 'Service marked as deleted', service });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete service', details: error.message });
    }
}

exports.getService = async (req, res) => {
    try {
        const { id } = req.params;
        const service = await Service.findById(id);
        if (!service) {
            return res.status(404).json({ error: 'Service not found' });
        }
        res.status(200).json({ service });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch service', details: error.message });
    }
};

exports.getAllServices = async (req, res) => {
    try {
        // Find all active services
        const services = await Service.find({ status:'active' });

        // For each service, count related appointments
        // const servicesWithAppointmentCount = await Promise.all(
        //     services.map(async (service) => {
        //         const appointmentCount = await Appointment.countDocuments({ serviceId: service._id });
        //         return {
        //             ...service.toObject(),
        //             appointmentCount
        //         };
        //     })
        // );

        res.status(200).json({ services: services });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch services', details: error.message });
    }
};