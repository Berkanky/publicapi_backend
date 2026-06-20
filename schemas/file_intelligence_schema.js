var mongoose = require("mongoose");

var file_intelligence_schema = new mongoose.Schema({
    subscriber_id:{
        type: mongoose.Schema.Types.ObjectId,
        required: false,
        ref: 'subscribers'
    },
    session_id:{
        type: String,
        required: false
    },
    file_id:{
        type: String,
        required: false
    },
    created_date:{
        type: Date,
        required: false
    },
    analysis_result:{ //aes256gcm
        type: String,
        required: false
    },
    job_id:{
        type: String,
        required: false
    },
    status:{
        type: String,
        required: false
    },
    buffer: { //sha256
        type: String,
        required: false
    },
    country_alpha_2_code: {
        type: String,
        required: false
    },
});

file_intelligence_schema.index({ created_date: 1 });
file_intelligence_schema.index({ analysis_result: 1 });
file_intelligence_schema.index({ job_id: 1 });
file_intelligence_schema.index({ file_id: 1 });

var fileintelligence = mongoose.model("fileintelligence", file_intelligence_schema);
module.exports = fileintelligence;