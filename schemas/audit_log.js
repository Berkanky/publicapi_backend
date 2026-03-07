var mongoose = require("mongoose");

var audit_log_schema = new mongoose.Schema({
    request_id: {
        type: String,
        default: null
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
    },
    phone_number_hash: {
        type: String,
        required: false
    }
});

audit_log_schema.index({ request_id: 1 });
audit_log_schema.index({ session_id: 1 });
audit_log_schema.index({ phone_number_hash: 1 });
audit_log_schema.index({ user_id: 1, created_date: -1 });
audit_log_schema.index({ action: 1, created_date: -1 });
audit_log_schema.index({ path: 1, method: 1, created_date: -1 });

var auditlog = mongoose.model("auditlog", audit_log_schema);
module.exports = auditlog;