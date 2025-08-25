const Appointment = require('../models/Appointment');
const User = require('../models/User');

// ===== USER ANALYTICS =====
exports.getUserSummary = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const blockedUsers = await User.countDocuments({ isBlocked: true });
    const admins = await User.countDocuments({ role: 'admin' });

    const last30Days = await User.aggregate([
      { $match: { createdAt: { $gte: new Date(Date.now() - 30*24*60*60*1000) } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    res.json({ totalUsers, blockedUsers, admins, growth: last30Days });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// ===== APPOINTMENT ANALYTICS =====
exports.getAppointmentSummary = async (req, res) => {
  try {
    const totalAppointments = await Appointment.countDocuments();
    const pending = await Appointment.countDocuments({ status: 'Pending' });
    const confirmed = await Appointment.countDocuments({ status: 'Confirmed' });
    const cancelled = await Appointment.countDocuments({ status: 'Cancelled' });

    const upcoming = await Appointment.countDocuments({ appointmentDate: { $gte: new Date() } });
    const past = await Appointment.countDocuments({ appointmentDate: { $lt: new Date() } });

    res.json({ totalAppointments, pending, confirmed, cancelled, upcoming, past });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getAppointmentTrends = async (req, res) => {
  try {
    const trends = await Appointment.aggregate([
      { $group: { 
        _id: { $dateToString: { format: "%Y-%m", date: "$appointmentDate" } }, 
        count: { $sum: 1 } 
      }},
      { $sort: { _id: 1 } }
    ]);
    res.json(trends);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getPopularServices = async (req, res) => {
  try {
    const services = await Appointment.aggregate([
      { $group: { _id: "$serviceType", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);
    res.json(services);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getPatientRanking = async (req, res) => {
  try {
    const ranking = await Appointment.aggregate([
      { $group: { _id: "$patientId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "patient"
      }},
      { $unwind: "$patient" },
      { $project: { name: "$patient.name", email: "$patient.email", count: 1 } }
    ]);
    res.json(ranking);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};
