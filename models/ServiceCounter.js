// models/ServiceCounter.js
const mongoose = require('mongoose');

const serviceCounterSchema = new mongoose.Schema({
  serviceId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
  counter: { type: Number, default: 0 }
});

module.exports = mongoose.model('ServiceCounter', serviceCounterSchema);
