var mongoose = require("mongoose");

var subscribers_schema = new mongoose.Schema({
    job_id: {
        type: String,
        required: false,
    },
    session_id:{
        type: String,
        required: true,
        unique: true,
        sparse: true
    },
    email_address: {
        type: String,
        required: true,
        unique: true
    },
    subscription_date: {
        type: Date,
        required: false
    },
    active: {
        type: Boolean,
        required: false
    },
    subscription_cancellation_date: {
        type: Date,
        required: false
    },
    daily_post: {
        type: Boolean,
        required: false
    },
    category:{
        type: String,
        required: false
    },
    default_locale_code: {
        type: String,
        required: false
    },
    verified: {
        type: Boolean,
        required: false
    },
    status: {
        type: String,
        required: false
    },
    verification_code:{
        type: String,
        required: false
    },
    verification_code_expire_date:{
        type: Date,
        required: false
    },
    subscription_cancellation_verification_code:{
        type: String,
        required: false
    },
    subscription_cancellation_verification_code_expire_date:{
        type: Date,
        required: false
    },
    login_date: {
        type: Date,
        required: false
    },
    login_type:{
        type: String,
        required: false
    }
});

var subscribers = mongoose.model("subscribers", subscribers_schema);
module.exports = subscribers;