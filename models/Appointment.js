const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const appointmentSchema = new Schema({
    patient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    doctor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    appointmentDate: {
        type: Date,
        required: true
    },
    MessageFromUser: {
        type: String,
        trim: true
    },
    MessageFromDoctor: {
        type: String,
        trim: true
    },
    AppointmentMessage: {
        type: String,
        trim: true
    },
    serviceType: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service',
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Scheduled', 'Cancelled'],
        default: 'Pending'
    },
    document: [
        {
            title: { type: String, trim: true, required: true },
            link: { type: String, trim: true, required: true }
        }
    ]
}, { timestamps: true });

module.exports = mongoose.model('Appointment', appointmentSchema);