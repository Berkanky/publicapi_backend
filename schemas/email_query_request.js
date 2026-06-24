var mongoose = require("mongoose");

var email_address_request_schema = new mongoose.Schema({
    subscriber_id:{
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'subscribers'
    },
    email_address_hash: {
        type: String,
        required: true,
    },
    created_date: {
        type: Date,
        required: true
    }
});

var emailaddressrequest = mongoose.model("emailaddressrequest", email_address_request_schema);
module.exports = emailaddressrequest;