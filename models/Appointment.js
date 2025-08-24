const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const appointmentSchema = new Schema({
    patientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    patientName: {  
        type: String,
        required: true,
        trim: true
    },
    patientEmail:{
        type: String,
        required: true,
        trim: true
    },
    patientPhone:{
        type: String,
        required: true,
        trim: true
    },
    appointmentDate: {
        type: Date,
        required: true
    },  
    Message: {
        type: String,
        trim: true
    },
    serviceType: {
        type: String,
        required: true,
        trim: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Confirmed', 'Cancelled'],
        default: 'Pending'
    }
}, { timestamps: true });

module.exports = mongoose.model('Appointment', appointmentSchema);