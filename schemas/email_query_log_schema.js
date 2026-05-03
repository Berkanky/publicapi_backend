var mongoose = require("mongoose");

var email_query_log_schema = new mongoose.Schema(
{
    input_email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        index: true
    },

    email_hash: {
        type: String,
        required: true,
        index: true
    },

    normalized_email: {
        type: String,
        default: null,
        trim: true,
        lowercase: true,
        index: true
    },

    local_part: {
        type: String,
        default: null,
        trim: true
    },

    domain: {
        type: String,
        default: null,
        trim: true,
        lowercase: true,
        index: true
    },

    registrable_domain: {
        type: String,
        default: null,
        trim: true,
        lowercase: true,
        index: true
    },

    tld: {
        type: String,
        default: null,
        trim: true,
        lowercase: true,
        index: true
    },

    syntax_is_valid: {
        type: Boolean,
        default: null,
        index: true
    },

    domain_exists: {
        type: Boolean,
        default: null
    },

    mx_exists: {
        type: Boolean,
        default: null,
        index: true
    },

    spf_present: {
        type: Boolean,
        default: null
    },

    dmarc_present: {
        type: Boolean,
        default: null
    },

    is_disposable: {
        type: Boolean,
        default: null,
        index: true
    },

    is_free_provider: {
        type: Boolean,
        default: null,
        index: true
    },

    is_role_based: {
        type: Boolean,
        default: null
    },

    is_business_email: {
        type: Boolean,
        default: null,
        index: true
    },

    risk_score: {
        type: Number,
        default: null,
        index: true
    },

    risk_level: {
        type: String,
        default: null,
        trim: true,
        lowercase: true,
        index: true
    },

    risk_signals: {
        type: [String],
        required: false
    },

    cache_status: {
        type: String,
        default: null,
        trim: true,
        lowercase: true
    },

    query_count: {
        type: Number,
        default: 1
    },

    last_query_date: {
        type: Date,
        default: new Date(),
        index: true
    }
},
{
    versionKey: false,
    timestamps: true,
    collection: "email_query_logs"
}
);

email_query_log_schema.index({ email_hash: 1 });
email_query_log_schema.index({ domain: 1, last_query_date: -1 });
email_query_log_schema.index({ risk_level: 1, last_query_date: -1 });
email_query_log_schema.index({ is_disposable: 1, last_query_date: -1 });

var email_query_log = mongoose.model("email_query_logs", email_query_log_schema);

module.exports = email_query_log;