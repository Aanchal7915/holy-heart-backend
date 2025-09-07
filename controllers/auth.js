const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const crypto = require('crypto');
const mailSender = require('../utils/mailSender');
const { registerSchema, loginSchema } = require('../validators/user');
dotenv.config();

const verifyEmailTokenExpiry = 1000 *60*60;
const resetPassTokenExpiry = 1000 *60*60;
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

        const { name, email, phoneNu, password, role = 'user', gender='prefer not to say' }  = parseResult.data;
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already exists' });
        }

		// Generate verification token
		const emailVerificationToken = crypto.randomBytes(32).toString('hex');
		const emailVerificationExpires = Date.now() + verifyEmailTokenExpiry; // 1 hour
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ 
			name, 
			email, 
			phoneNu, 
			password: hashedPassword, 
			role,
			gender,
			emailVerificationToken,
			emailVerificationExpires
		});
        await user.save();
        user.password = undefined; // Hide password in response

		// Send verification email
		const verifyUrl = `${process.env.FRONTEND_URL}/verify-email/${user._id}/${emailVerificationToken}`;
		await mailSender(email, 'Verify your email', `<p>Click <a href="${verifyUrl}">here</a> to verify your email. This link expires in 1 hour.</p>`);


        res.status(201).json({ message: 'User registered successfully.Please check your email to verify your account.', user });
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

		if (user.isVerified === false) {
			return res.status(403).json({ error: 'You have not verified your email. Please verify!' });
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


// // Login controller
// exports.login = async (req, res) => {
// 	try {
// 		const { email, password } = req.body;
// 		if (!email || !password) {
// 			return res.status(400).json({ message: 'Email and password are required' });
// 		}

// 		const user = await User.findOne({ email });
// 		if (!user) {
// 			return res.status(400).json({ message: `User doesn't exist! Please sign up first.` });
// 		}

// 		if (user.isVerified === false) {
// 			return res.status(403).json({ message: 'You have not verified your email. Please verify!' });
// 		}

// 		const isMatch = await bcrypt.compare(password, user.password);
// 		if (!isMatch) {
// 			return res.status(400).json({ message: 'Invalid password!' });
// 		}

// 		// Generate JWT token
// 		user.password = undefined;
// 		const token = jwt.sign({ userId: user._id, userRole: user.role }, process.env.JWT_SECRETE, { expiresIn: '1h' });
// 		res.status(200).json({ token, user });
// 	} catch (err) {
// 		console.error("Error in login:", err);
// 		res.status(500).json({ message: 'Server error' });
// 	}
// };

// exports.signup = async (req, res) => {
// 	try {

// 		const { name, email, password, phoneNu } = req.body;
// 		// Check if user already exists
// 		if (!name || !email || !password || !phoneNu) {
// 			return res.status(400).json({ message: 'All fields are required' });
// 		}

// 		// Check if user exists
// 		const existingUser = await User.findOne({ email });
// 		if (existingUser) {
// 			return res.status(400).json({ message: 'Email already registered' });
// 		}

		
// 		// Hash password
// 		const hashedPassword = await bcrypt.hash(password, 10);

// 		// Create user (isVerified: false)
// 		const user = new User({
// 			email,
// 			password: hashedPassword, // hash if needed
// 			name,
// 			phoneNu,
// 			role: 'user',
// 			isVerified: false,
// 			emailVerificationToken,
// 			emailVerificationExpires,
// 		});
// 		await user.save();

// 		// Send verification email
// 		const verifyUrl = `${process.env.FRONTEND_URL}/verify-email/${user._id}/${emailVerificationToken}`;
// 		await mailSender(email, 'Verify your email', `<p>Click <a href="${verifyUrl}">here</a> to verify your email. This link expires in 1 hour.</p>`);


// 		res.status(201).json({ message: 'Signup successful! Please check your email to verify your account.' });
// 	} catch (err) {
// 		console.error("Error in signup:", err);
// 		res.status(500).json({ message: 'Server error' });
// 	}
// };


exports.verifyEmail = async (req, res) => {
	try {
		const { token, id } = req.params;
		const user = await User.findOne({
			_id:id,
			emailVerificationToken: token,
			emailVerificationExpires: { $gt: Date.now() },
		});
		if (!user) {
			return res.status(400).json({ message: 'Invalid or expired verification link.' });
		}
		user.isVerified = true;
		user.emailVerificationToken = undefined;
		user.emailVerificationExpires = undefined;
		await user.save();
		res.json({ message: 'Email verified successfully! You can now log in.' });
	} catch (err) {
		console.error("Error in verifyEmail:", err);
		res.status(500).json({ message: 'Server error' });
	}
};

exports.forgotPassword = async (req, res) => {
	try {
		const { email } = req.body;
		if (!email) {
			return res.status(400).json({ message: 'Email is required' });
		}
		const user = await User.findOne({ email });
		if (!user) {
			return res.status(400).json({ message: 'No user found with that email' });
		}
		if(user.isVerified === false) {
			return res.status(403).json({ message: 'You have not verified your email. Please verify!' });
		}
		const resetToken = crypto.randomBytes(32).toString('hex');
		const resetTokenExpiry = Date.now() + resetPassTokenExpiry; // 1 hour
		user.resetPasswordToken = resetToken;
		user.resetPasswordExpires = resetTokenExpiry;
		await user.save();
		const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${user._id}/${resetToken}`;
		const ress=await mailSender(email, 'Password Reset', `<p>Click <a href="${resetUrl}">here</a> to reset your password. This link expires in 1 hour.</p>`);
		console.log("mail sent response:",ress);
		res.json({ message: 'If the email exists, a reset link was sent.' });
	}
	catch (err) {
		console.error("Error in forgotPassword:", err);
		res.status(500).json({ message: 'Server error' });
	}
};
exports.resetPassword = async (req, res) => {
	try {
		const { token, id, newPassword } = req.body;
		if (!token || !id || !newPassword) {
			return res.status(400).json({ message: 'All fields are required' });
		}
		
		const user = await User.findOne({
			_id:id,
			resetPasswordToken: token,
			resetPasswordExpires: { $gt: Date.now() },
		});
		if (!user) {
			return res.status(400).json({ message: 'Invalid or expired token' });
		}
		const hashedPassword = await bcrypt.hash(newPassword, 10);
		user.password = hashedPassword;
		user.resetPasswordToken = undefined;
		user.resetPasswordExpires = undefined;
		await user.save();
		res.json({ message: 'Password reset successful! You can now log in with your new password.' });
	} catch (err) {
		console.error("Error in resetPassword:", err);
		res.status(500).json({ message: 'Server error' });
	}
};

// Resend verification email
exports.resendVerificationEmail = async (req, res) => {
	try {
		const { id } = req.body;
		if (!id) {
			return res.status(400).json({ message: 'Id is required' });
		}
		const user = await User.findOne({ _id:id });
		if (!user) {
			return res.status(400).json({ message: 'No user found!' });
		}
		if (user.isVerified) {
			return res.status(400).json({ message: 'Email is already verified' });
		}
		// Generate new verification token
		const emailVerificationToken = crypto.randomBytes(32).toString('hex');
		const emailVerificationExpires = Date.now() + verifyEmailTokenExpiry; // 1 hour
		user.emailVerificationToken = emailVerificationToken;
		user.emailVerificationExpires = emailVerificationExpires;
		await user.save();
		const verifyUrl = `${process.env.FRONTEND_URL}/verify-email/${user._id}/${emailVerificationToken}`;
		await mailSender(email, 'Verify your email', `<p>Click <a href="${verifyUrl}">here</a> to verify your email. This link expires in 1 hour.</p>`);
		res.json({ message: 'A new verification email has been sent to your email address. Please verify!' });
	} catch (err) {
		console.error("Error in resendVerificationEmail:", err);
		res.status(500).json({ message: 'Server error' });
	}
};

