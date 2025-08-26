const jwt = require('jsonwebtoken');
const dotenv=require('dotenv');
dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

exports.auth = (roles = []) => {
    // roles param can be a string or array
    if (typeof roles === 'string') {
        roles = [roles];
    }
    return (req, res, next) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided. Please Login!' });
        }
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.user = decoded;
            if (roles.length && !roles.includes(decoded.role)) {
                return res.status(403).json({ error: 'Forbidden: insufficient role' });
            }
            next();
        } catch (error) {
            return res.status(401).json({ error: 'Invalid token. Please Login!' });
        }
    };
};
