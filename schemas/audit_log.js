var mongoose = require("mongoose");

var audit_log_schema = new mongoose.Schema({
    request_id: {
        type: String,
        default: null
    },
    subscriber_id: {
        type: String,
        required: false,
    },
    session_id: {
        type: String,
        default: null
    },
    action: {
        type: String,
        required: false
    },
    success: {
        type: Boolean,
        required: false
    },
    http_status: {
        type: Number,
        default: null
    },
    ip_address: {
        type: String,
        default: null
    },
    user_agent: {
        type: String,
        default: null
    },
    geo_country: {
        type: String,
        default: null
    },
    created_date: {
        type: Date,
        default: Date.now
    },
    method: {
        type: String,
        required: false
    },
    path: {
        type: String,
        required: false
    },
    provider: {
        type: String,
        required: false
    }
});

var auditlog = mongoose.model("auditlog", audit_log_schema);
module.exports = auditlog;