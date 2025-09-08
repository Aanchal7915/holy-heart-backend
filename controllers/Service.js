const Service = require('../models/Service');
const Appointment = require('../models/Appointment');
const removeFile = require('../utils/removeFile');

//if any service is marked active, inactive accordingly update and also individual slot also

// Add a new service
exports.addService = async (req, res) => {
    try {
        const { name, description, type, duration } = req.body;
        console.log("body", req.body);
        if (!name || !description || !duration) {
            return res.status(400).json({ error: 'Name, duration and description are required' });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'Image file is required' });
        }

        if(type && !['test','treatment'].includes(type.toLowerCase())) {
            return res.status(400).json({ error: 'Type must be either "test" or "treatment"' });
        }

        if(type && type.toLowerCase() ==='test' && (!req.body.price || isNaN(req.body.price) || req.body.price < 0) ) {
            return res.status(400).json({ error: 'Price is required for test type and must be a non-negative number' });
        }

        const service = new Service({ 
            name, 
            description, 
            status: 'active', 
            image: `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`,
            type:type?.toLowerCase() || 'treatment',
            price: type?.toLowerCase() === 'test' ? parseFloat(req.body.price) : 0
        });
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
        let { name, description, status, duration, type, price } = req.body;
        let updates = {};
        if (name) updates.name = name;
        if (description) updates.description = description;
        if (status) status = status.toLowerCase();
        if (status && ['active', 'inactive'].includes(status)) updates.status = status;
        if (type) {
            type = type.toLowerCase();
            if (!['test', 'treatment'].includes(type)) {
                return res.status(400).json({ error: 'Type must be either "test" or "treatment"' });
            }
            updates.type = type;
            if (type === 'test') {
                if (price === undefined || isNaN(price) || price < 0) {
                    return res.status(400).json({ error: 'Price is required for test type and must be a non-negative number' });
                }
                updates.price = parseFloat(price);
            } else {
                updates.price = 0; // Reset price for treatment type
            }
        }
        
        if (duration) {
            if (isNaN(duration) || duration <= 0) {
                return res.status(400).json({ error: 'Duration must be a positive number' });
            }
            updates.duration = duration;
        }


        // If updating image, remove previous image file
        if (req.file) {
            const service = await Service.findById(id);
            if (service && service.image) {
                // Extract filename from URL
                const filename = service.image.split('/').pop();
                removeFile(filename);
            }
            updates.image = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
        }
        //if service status is being set to deleted, also update related appointments to 'cancelled' or another status as needed and also update status of slot accordingly
        if (status === 'deleted') {
            await Appointment.updateMany({ serviceId: id }, { status: 'cancelled' });
        }

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
        const type= req.query.type;
        if(type && !['test','treatment'].includes(type.toLowerCase())) {
            return res.status(400).json({ error: 'Type must be either "test" or "treatment"' });
        }
        let filter={ status:'active' };
        if(type) filter.type=type.toLowerCase();    

        const services = await Service.find(filter);

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