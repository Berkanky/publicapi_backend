const mongoose = require("mongoose");

var refresh_session_schema = new mongoose.Schema({
    user_id: { 
        type: mongoose.Schema.Types.ObjectId, 
        required: true, 
        index: true, 
        ref: "user" 
    },
    session_id:{
        type: String,
        required: true
    },
    refresh_token_hash: { 
        type: String, 
        required: true, 
        unique: true, 
        index: true 
    },
    revoked_date: { 
        type: Date,
        default: null 
    },
    is_revoked: {
        type: Boolean,
        required: true,
    },
    expired_date: { 
        type: Date, 
        required: true, 
        index: true 
    },
    created_date: { 
        type: Date,
        required: true
    },
    last_used_date: { 
        type: Date, 
        default: null 
    },
    revoke_reason:{
        type: String,
        required: false
    }
});

var refresh_session = mongoose.model('refresh_session', refresh_session_schema);
module.exports = refresh_session;