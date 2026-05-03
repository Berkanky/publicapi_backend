var mongoose = require("mongoose");

var file_intelligence_schema = new mongoose.Schema({
    session_id:{
        type: String,
        required: true
    },
    file_id:{
        type: String,
        required: true
    },
    country_reference_id:{
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'country_reference',
        index: true
    },
    created_date:{
        type: Date,
        required: true
    },
    analysis_result:{ //aes256gcm
        type: String,
        required: false
    },
    job_id:{
        type: String,
        required: true
    },
    status:{
        type: Number,
        required: true
    },
    buffer: { //sha256
        type: String,
        required: true
    }
});

file_intelligence_schema.index({ created_date: 1 });
file_intelligence_schema.index({ analysis_result: 1 });
file_intelligence_schema.index({ session_id: 1 });
file_intelligence_schema.index({ job_id: 1 });
file_intelligence_schema.index({ file_id: 1 });
file_intelligence_schema.index({ country_reference_id: 1 });

var fileintelligence = mongoose.model("fileintelligence", file_intelligence_schema);
module.exports = fileintelligence;