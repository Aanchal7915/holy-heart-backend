const OPDS = require('../models/OPDS');

exports.saveOPDS = async (req, res) => {
    try {
        const opds = new OPDS(req.body);
        await opds.save();
        res.status(201).json({ message: 'OPDS saved successfully', opds });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save OPDS', details: error.message });
    }
};