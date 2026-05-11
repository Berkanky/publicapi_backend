var mongoose = require("mongoose");

var news_request_schema = new mongoose.Schema({
    email_address: {
        type: String,
        required: true
    },
    session_id:{
        type: String,
        required: true
    },
    job_id: {
        type: String,
        required: true
    },
    start_date:{
        type: Date,
        required: false
    },
    end_date:{
        type: Date,
        required: false
    },
    default_locale_code: {
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
    }
});

news_request_schema.index({ session_id: 1 }, { unique: true });

var news_request = mongoose.model("news_request", news_request_schema);
module.exports = news_request;