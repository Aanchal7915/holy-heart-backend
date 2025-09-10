const mongoose = require("mongoose");

const TestBookingSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
    },
    phoneNu: {
      type: String,
      required: true,
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
      required: true,
    },
    test: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
    },

    // Razorpay Payment Details
    razorpayOrderId: {
      type: String,
      required: true,
    },
    razorpayPaymentId: {
      type: String,
    },
    razorpaySignature: {
      type: String,
    },

    // Core payment metadata
    amount: {
      type: Number, // stored in paise
      required: true,
    },
    currency: {
      type: String,
      default: "INR",
    },
    status: {
      type: String,
      enum: ["created", "authorized", "captured", "failed", "refunded"],
      default: "created",
    },
    method: {
      type: String, // upi, card, netbanking, wallet
    },
    paymentDetails: {
      cardLast4: String,
      cardNetwork: String,
      upiId: String,
      wallet: String,
      bank: String,
    },
    // Timeline
    createdAt: {
      type: Date,
      default: Date.now,
    },
    capturedAt: {
      type: Date,
    },
    reports:[String],
    // Additional fields can be added as needed
  },
  { timestamps: true }
);

module.exports = mongoose.model("TestBooking", TestBookingSchema);