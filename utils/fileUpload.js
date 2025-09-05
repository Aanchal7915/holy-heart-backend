const multer = require("multer");

// store in /uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, req.user.userId+Date.now() + "-" + file.originalname)
});

const upload = multer({ storage });
module.exports = upload;