const mongoose = require("mongoose");

const doctorSlotSchema = new mongoose.Schema({
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  services: [
    {
      service: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service'
      },
      chargePerAppointment: Number
    }
  ],

  weeklyAvailability: [
    {
      day: {
        type: String,
        enum: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
      },
      slots: [
        {
          service: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Service'
          },
          start: { type: String},      
          end: { type: String},
          chargePerAppointment: { type: Number}          
        }
      ]
    }
  ]
},{ timestamps: true });

module.exports = mongoose.model("DoctorSlot", doctorSlotSchema);
