const fs = require('fs');
const path = require('path');

const removeFile = (filename) => {
    if (!filename) return;
    const filePath = path.join(__dirname, '..', 'uploads', filename);
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (!err) {
            fs.unlink(filePath, (err) => {
                if (err) {
                    console.error(`Failed to remove file: ${filePath}`, err);
                }
            });
        }
    });
};

module.exports = removeFile;


// const fs = require('fs');
// const path = require('path');

// // Middleware: delete file if already exists
// function deleteIfExists(filename, folder = 'uploads') {
//   return (req, res, next) => {
//     if (!filename) return next();

//     const filePath = path.join(__dirname, folder, filename);

//     fs.access(filePath, fs.constants.F_OK, (err) => {
//       if (!err) {
//         fs.unlink(filePath, (err) => {
//           if (err) console.error("Error deleting file:", err);
//           else console.log("Deleted old file:", filePath);
//           next();
//         });
//       } else {
//         next(); // file not found → continue
//       }
//     });
//   };
// }

// module.exports = deleteIfExists;
