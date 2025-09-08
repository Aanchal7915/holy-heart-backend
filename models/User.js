const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    gender: {
        type: String,
        enum:['male', 'female', 'prefer not to say'],
        default: 'prefer not to say'
    },
    specialization:{
        type:String
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    phoneNu: {
        type: String,
        required: true,
        trim: true
    },
    address: {
        type: String,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['user', 'admin', 'doctor'],
        default: 'user'
    },
    image: {
        type: String,
        trim: true
    },
    isBlocked: {
        type: Boolean,
        default: false
    }, 
    isVerified: {
        type: Boolean,
        default: false
    },
    emailVerificationToken: {
        type: String
    },
    emailVerificationExpires: {
        type: Date
    },
    resetPasswordToken: {
        type: String
    },
    resetPasswordExpires: {
        type: Date
    }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
