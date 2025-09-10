const TestBooking = require("../models/TestBooking");

// @desc    Get all test bookings (Admin Dashboard)
// @route   GET /api/admin/test-bookings
// @access  Admin
exports.getAllTestBookings = async (req, res) => {
  try {
    let {
      status,
      gender,
      doctor,
      patient,
      startDate,
      endDate,
      sort = "-createdAt", // default: newest first
      page = 1,
      limit = 10,
    } = req.query;

    const filter = {};

    if (status) filter.status = status;
    if (gender) filter.gender = gender;
    if (doctor) filter.doctor = doctor;
    if (patient) filter.patient = patient;

    // Date range filter (createdAt)
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(new Date(startDate).setHours(0, 0, 0, 0));
      }
      if (endDate) {
        filter.createdAt.$lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
      }
    }

    // Convert to numbers
    page = parseInt(page);
    limit = parseInt(limit);
    const skip = (page - 1) * limit;

    // Query
    const query = TestBooking.find(filter)
      .populate("patient", "name email phoneNu")
      .populate("doctor", "name email phoneNu")
      .populate("test", "name description type")
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const [bookings, total] = await Promise.all([
      query,
      TestBooking.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      count: bookings.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      bookings,
    });
  } catch (error) {
    console.error("AdminController - getAllTestBookings:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch test bookings",
      details: error.message,
    });
  }
};


exports.getUserTestBookings = async (req, res) => {
  try {
    const userId = req.user.userId; // assuming req.user is set after auth middleware
console.log(userId);

    // Filters
    const { status, testName, doctorName, startDate:fromDate, endDate:toDate, sortBy, sortOrder, page, limit } = req.query;
    let filter = { patient: userId };

    if (status) filter.status = status;
    if (fromDate || toDate) filter.createdAt = {};
    if (fromDate) filter.createdAt.$gte = new Date(fromDate);
    if (toDate) filter.createdAt.$lte = new Date(toDate);

    // Pagination
    const pageNum = parseInt(page) || 1;
    const pageSize = parseInt(limit) || 10;
    const skip = (pageNum - 1) * pageSize;

    // Sorting
    const sort = {};
    if (sortBy) sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Query with population
    const bookings = await TestBooking.find(filter)
      .populate("patient", "name email phoneNu")
      .populate("doctor", "name email")
      .populate("test", "name description")
      .sort(sort)
      .skip(skip)
      .limit(pageSize);

    const total = await TestBooking.countDocuments(filter);

    res.json({
      data: bookings,
      page: pageNum,
      totalPages: Math.ceil(total / pageSize),
      totalRecords: total,
    });
  } catch (err) {
console.log(err);
    res.status(500).json({ error: err.message });
  }
};
