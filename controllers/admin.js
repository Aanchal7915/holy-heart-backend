const Appointment = require('../models/Appointment');
const User = require('../models/User');

// ===== USER ANALYTICS =====
exports.getUserSummary = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const blockedUsers = await User.countDocuments({ isBlocked: true });
    const admins = await User.countDocuments({ role: 'admin' });

    const last30Days = await User.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({ totalUsers, blockedUsers, admins, growth: last30Days });
  } catch (error) {
    console.error('AdminController - getUserSummary:', error);
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

    const upcoming = await Appointment.countDocuments({ start: { $gte: new Date() } });
    const past = await Appointment.countDocuments({ start: { $lt: new Date() } });

    res.json({
      totalAppointments,
      pending,
      confirmed,
      cancelled,
      upcoming,
      past
    });
  } catch (error) {
    console.error('AdminController - getAppointmentSummary:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getAppointmentTrends = async (req, res) => {
  try {
    const trends = await Appointment.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$start" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    res.json(trends);
  } catch (error) {
    console.error('AdminController - getAppointmentTrends:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getPopularServices = async (req, res) => {
  try {
    const services = await Appointment.aggregate([
      { $group: { _id: "$service", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "services", // collection name in Mongo
          localField: "_id",
          foreignField: "_id",
          as: "service"
        }
      },
      { $unwind: "$service" },
      {
        $project: {
          _id: 0,
          serviceId: "$service._id",
          name: "$service.name",
          description: "$service.description",
          count: 1
        }
      }
    ]);
    res.json(services);
  } catch (err) {
    console.error('AdminController - getPopularServices:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getPatientRanking = async (req, res) => {
  try {
    const ranking = await Appointment.aggregate([
      { $group: { _id: "$patient", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "patient"
        }
      },
      { $unwind: "$patient" },
      {
        $project: {
          _id: 0,
          name: "$patient.name",
          email: "$patient.email",
          count: 1
        }
      }
    ]);
    res.json(ranking);
  } catch (error) {
    console.error('AdminController - getPatientRanking:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
