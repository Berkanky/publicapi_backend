const mongoose = require("mongoose");

var issued_jti_schema = new mongoose.Schema({
    jti:{
        type: String,
        required: false
    },
    created_date: {
        type: Date,
        required: false
    }
});

var refresh_session_schema = new mongoose.Schema({
    subscriber_id: { 
        type: mongoose.Schema.Types.ObjectId, 
        required: true,
        ref: "subscribers" 
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
    replaced_by_hash: { 
        type: String, 
        default: null 
    },
    revoked_date: { 
        type: Date,
        default: null 
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
    issued_jtis:[issued_jti_schema]
});

refresh_session_schema.index({ expires_date: 1 }, { expireAfterSeconds: 0 });

var refresh_session = mongoose.model('refresh_session', refresh_session_schema);
module.exports = refresh_session;