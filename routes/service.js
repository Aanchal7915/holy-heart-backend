const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/Service');
const { auth } = require('../middleware/auth');
const upload = require('../utils/fileUpload');

// Add a new service
router.post('/', auth(['admin']), upload.single('image') ,serviceController.addService);

// Update a service
router.put('/:id', auth(['admin']), upload.single('image'), serviceController.updateService);

// Mark a service as deleted (soft delete)
router.delete('/:id', auth(['admin']), serviceController.deleteService);

// Get a specific service
router.get('/:id', auth(['admin', 'user']), serviceController.getService);

// Get all services
router.get('/', auth(['admin', 'user']), serviceController.getAllServices);

module.exports = router;