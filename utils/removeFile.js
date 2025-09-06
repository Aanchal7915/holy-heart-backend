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