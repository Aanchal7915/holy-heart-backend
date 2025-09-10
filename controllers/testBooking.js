const TestBooking = require("../models/TestBooking");
const removeFile = require('../utils/removeFile');

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


// Upload multiple images for an appointment
exports.uploadReport = async (req, res) => {
    try {
        // console.log("reached...")
        const { testIId } = req.params;
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No images uploaded' });
        }

        // Get image URLs
        const imageUrls = req.files.map(file =>
            `${req.protocol}://${req.get("host")}/uploads/${file.filename}`
        );

        // Update appointment with new images (append if already exist)
        const tb = await TestBooking.findById(testId);
        if (!tb) {
            return res.status(404).json({ error: 'Appointment not found' });
        }

        if (!tb.reports) appointment.reports = [];
        tb.reports.push(...imageUrls);
        await tb.save();

        res.status(200).json({ message: 'Report uploaded successfully', images: appointment.images });
    } catch (error) {
        res.status(500).json({ error: 'Failed to upload report', details: error.message });
    }
};

// Delete an image from an appointment
exports.deleteReport = async (req, res) => {
    try {
        const { testId } = req.params;
        const { pdfUrl } = req.body;
        if (!pdfUrl) {
            return res.status(400).json({ error: 'pdfUrl is required' });
        }

        const tb = await TestBooking.findById(testId);
        if (!tb) {
            return res.status(404).json({ error: 'Appointment not found' });
        }

        // Remove image from array
        const pdfIndex = tb.reports.findIndex(url => url === pdfUrl);
        if (pdfIndex === -1) {
            return res.status(404).json({ error: 'Pdf not found in appointment' });
        }

        tb.reports.splice(pdfIndex, 1);
        await tb.save();

        // Remove file from uploads folder
        const filename = pdfUrl.split('/').pop();
        removeFile(filename);

        res.status(200).json({ message: 'Pdf deleted successfully', images: appointment.images });
    } catch (error) {
        console.error('DoctorController - deleteAppointmentImage:', error);
        res.status(500).json({ error: 'Failed to delete pdf', details: error.message });
    }
};