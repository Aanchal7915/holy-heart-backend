// models/Appointment.js
const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
  start: { type: Date, required: true },
  end: { type: Date, required: true },
  charge: { type: Number, default: 0 },
  status: { type: String, enum: ['reserved','confirmed','cancelled','expired','completed'], default: 'reserved' },
  reservationExpiresAt: { type: Date },
  images: [{ type: String }],
}, { timestamps: true });

// index to speed lookups and overlap checks
appointmentSchema.index({ doctor: 1, start: 1, end: 1 });
appointmentSchema.index({ reservationExpiresAt: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);
