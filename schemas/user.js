const mongoose = require("mongoose");

const webauthn_schema = new mongoose.Schema({
    credential_id: {
        type: String,
        required: false
    },
    public_key: {
        type: String,
        required: false
    },
    counter: {
        type: Number,
        required: false
    },
    transports: {
        type: [String],
        required: false,
        default: []
    },
    is_deleted: {
        type: Boolean,
        required: false,
        default: false
    }
});

const user_schema = new mongoose.Schema({
    email_address: {
        type: String,
        required: true,
        unique: true
    },
    google_sub: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: false
    },
    surname: {
        type: String,
        required: false
    },
    display_name: {
        type: String,
        required: false
    },
    created_date: {
        type: Date,
        required: true
    },
    login_date: {
        type: Date
    },
    last_login_date: {
        type: Date
    },
    updated_date: {
        type: Date
    },
    active: {
        type: Boolean,
        required: false,
        default: true
    },
    role: {
        type: String,
        required: true,
        default: 'user',
        enum: ['user', 'admin', 'analyst'],
    },
    webauthn: { 
        type: [webauthn_schema], 
        required: false,
        default: [] 
    }
});

var user = mongoose.model('user', user_schema);
module.exports = user;