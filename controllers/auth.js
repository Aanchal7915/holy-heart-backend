const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const { registerSchema, loginSchema } = require('../validators/user');
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

exports.register = async (req, res) => {
    try {
        if (!req.body || typeof req.body !== 'object') {
            return res.status(400).json({ error: 'Request body is required' });
        }

        // Manual required fields check
        const requiredFields = ['name', 'email', 'phoneNu', 'password'];
        let missingFields = [];
        requiredFields.forEach(field => {
            if (
                !(field in req.body) ||
                req.body[field] === undefined ||
                req.body[field] === null ||
                (typeof req.body[field] === 'string' && req.body[field].trim() === '')
            ) {
                // Custom error messages for each field
                if (field === 'name') missingFields.push('Name is required');
                if (field === 'email') missingFields.push('Email is required');
                if (field === 'phoneNu') missingFields.push('Phone number is required');
                if (field === 'password') missingFields.push('Password is required');
            }
        });

        if (missingFields.length > 0) {
            return res.status(400).json({ error: missingFields.join(', ') });
        }

        // Zod validation
        const parseResult = registerSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({ error: parseResult.error.issues.map(e => e.message).join(', ') });
        }

        const { name, email, phoneNu, password, role = 'user' }  = parseResult.data;
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already exists' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ name, email, phoneNu, password: hashedPassword, role });
        await user.save();
        user.password = undefined; // Hide password in response
        res.status(201).json({ message: 'User registered successfully', user });
    } catch (error) {
        console.error('AuthController - register:', error);
        res.status(500).json({ error: 'Server error', message: 'Registration failed!' });
    }
};

exports.login = async (req, res) => {
    try {
        if (!req.body || typeof req.body !== 'object') {
            return res.status(400).json({ error: 'Request body is required' });
        }

        // Manual required fields check for login
        const requiredFields = ['email', 'password'];
        let missingFields = [];
        requiredFields.forEach(field => {
            if (
                !(field in req.body) ||
                req.body[field] === undefined ||
                req.body[field] === null ||
                (typeof req.body[field] === 'string' && req.body[field].trim() === '')
            ) {
                if (field === 'email') missingFields.push('Email is required');
                if (field === 'password') missingFields.push('Password is required');
            }
        });

        if (missingFields.length > 0) {
            return res.status(400).json({ error: missingFields.join(', ') });
        }

        const parseResult = loginSchema.safeParse(req.body);
        if (!parseResult.success) {
            return  res.status(400).json({ error: parseResult.error.issues.map(e => e.message).join(', ') });
        }
        const { email, password } = parseResult.data;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }
        if (user.isBlocked) {
            return res.status(403).json({ error: 'Your account is blocked. Please contact support.' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }
        const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
        res.status(200).json({ message: 'Login successful', token, user: { userId: user._id, userRole: user.role } });
    } catch (error) {
        console.error('AuthController - login:', error);
        res.status(500).json({ error: 'Server error', message: 'Login failed' });
    }
};

exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(200).json({ user });
    } catch (error) {
        console.error('AuthController - getProfile:', error);
        res.status(500).json({ error: 'Server error', message: 'Failed to fetch profile' });
    }
};

exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.status(200).json({ users });
    } catch (error) {
        console.error('AuthController - getAllUsers:', error);
        res.status(500).json({ error: 'Server error', message: 'Failed to fetch users' });
    }
};
