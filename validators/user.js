const { z } = require('zod');

const indianPhoneRegex = /^[6-9]\d{9}$/;

const registerSchema = z.object({
    name: z.string()
        .min(1, 'Name is required'),
    email: z.string()
        .min(1, 'Email is required')
        .email('Invalid email address'),
    phoneNu: z.string()
        .min(1, 'Phone number is required')
        .regex(indianPhoneRegex, 'Phone number must be a valid 10-digit Indian mobile number'),
    password: z.string()
        .min(6, 'Password must be at least 6 characters'),
    role: z.enum(['user', 'admin']).optional()
});

const loginSchema = z.object({
    email: z.string()
        .min(1, 'Email is required')
        .email('Invalid email address'),
    password: z.string()
        .min(1, 'Password is required')
});

module.exports = {
    registerSchema,
    loginSchema
};