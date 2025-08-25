const Appointment = require('../models/Appointment');

function getStartEndDates(year, month) {
    let start, end;
    if (year && month) {
        start = new Date(year, month - 1, 1);
        end = new Date(year, month, 0, 23, 59, 59, 999);
    } else if (year) {
        start = new Date(year, 0, 1);
        end = new Date(year, 11, 31, 23, 59, 59, 999);
    } else {
        const now = new Date();
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }
    return { start, end };
}

exports.getAppointmentStats = async (req, res) => {
    try {
        let { month, year } = req.query;
        const now = new Date();
        month = month ? parseInt(month) : undefined;
        year = year ? parseInt(year) : undefined;
        // If neither month nor year provided, use current month/year for both daily and monthly stats
        if (!month && !year) {
            month = now.getMonth() + 1;
            year = now.getFullYear();
        }
        const { start, end } = getStartEndDates(year, month);

        // Filter for date range
        const matchDate = { appointmentDate: { $gte: start, $lte: end } };

        // Always calculate dailyStats for the selected month/year
        let dailyStats = await Appointment.aggregate([
            { $match: matchDate },
            {
                $group: {
                    _id: { day: { $dayOfMonth: "$appointmentDate" }, status: "$status" },
                    count: { $sum: 1 }
                }
            },
            {
                $group: {
                    _id: "$_id.day",
                    stats: {
                        $push: { status: "$_id.status", count: "$count" }
                    },
                    total: { $sum: "$count" }
                }
            },
            { $sort: { "_id": 1 } }
        ]);

        // Always calculate monthlyStats for the selected year
        let monthlyStats = await Appointment.aggregate([
            { $match: { appointmentDate: { $gte: new Date(year, 0, 1), $lte: new Date(year, 11, 31, 23, 59, 59, 999) } } },
            {
                $group: {
                    _id: { month: { $month: "$appointmentDate" }, status: "$status" },
                    count: { $sum: 1 }
                }
            },
            {
                $group: {
                    _id: "$_id.month",
                    stats: {
                        $push: { status: "$_id.status", count: "$count" }
                    },
                    total: { $sum: "$count" }
                }
            },
            { $sort: { "_id": 1 } }
        ]);

        // Overall stats for the period
        const statusStats = await Appointment.aggregate([
            { $match: matchDate },
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 }
                }
            }
        ]);
        const totalAppointments = statusStats.reduce((acc, cur) => acc + cur.count, 0);

        // Service type stats for the period
        const serviceTypeStats = await Appointment.aggregate([
            { $match: matchDate },
            {
                $group: {
                    _id: { serviceType: "$serviceType", status: "$status" },
                    count: { $sum: 1 }
                }
            },
            {
                $group: {
                    _id: "$_id.serviceType",
                    stats: {
                        $push: { status: "$_id.status", count: "$count" }
                    },
                    total: { $sum: "$count" }
                }
            },
            { $sort: { "_id": 1 } }
        ]);

        res.status(200).json({
            period: { start, end },
            totalAppointments,
            statusStats,
            serviceTypeStats,
            dailyStats,
            monthlyStats
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch appointment stats', details: error.message });
    }
};



