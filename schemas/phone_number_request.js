var mongoose = require("mongoose");

var phone_number_request_schema = new mongoose.Schema({
    subscriber_id:{
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'subscribers'
    },
    phone_number_hash: {
        type: String,
        required: true,
    },
    created_date: {
        type: Date,
        required: true
    }
});

var phonenumberrequest = mongoose.model("phonenumberrequest", phone_number_request_schema);
module.exports = phonenumberrequest;