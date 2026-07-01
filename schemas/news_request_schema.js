var mongoose = require("mongoose");

var news_request_schema = new mongoose.Schema({
    subscriber_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'subscribers'
    },
    session_id:{
        type: String,
        required: false
    },
    job_id: {
        type: String,
        required: false
    },
    start_date:{
        type: Date,
        required: false
    },
    end_date:{
        type: Date,
        required: false
    },
    updated_date:{
        type: Date,
        required: false
    },
    country_alpha_2_code: {
        type: String,
        required: true
    },
    category:{
        type: String,
        required: true
    },
    created_date: {
        type: Date,
        required: true
    },
    status:{
        type: String,
        required: false
    },
    notification_status: {
        type: String,
        required: false
    },
    page_size:{
        type: Number,
        required: false
    },
    sort_by:{
        type: String,
        required: false
    },
    page:{
        type: Number,
        required: false
    },
    request_hash: {
        type: String,
        required: true
    },
    frequency:{
        type: String,
        required: false
    },
    is_scheduled:{
        type: Boolean,
        required: false
    },
    next_run_date:{
        type: Date,
        required: false
    },
    schedule_trigger_date:{
        type: Date,
        required: false
    },
    next_run_job_id:{
        type: String,
        required: false
    }
});

var news_request = mongoose.model("news_request", news_request_schema);
module.exports = news_request;