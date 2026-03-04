const mongoose = require("mongoose");

var phone_number_schema = new mongoose.Schema({
    phone_number_hash: { 
        type: String,
        required: true,
        unique: true,
        index: true
    },
    country_iso_code: {
        type: String,
        required: false
    },
    region_code: {
        type: String,
        required: false
    },
    carrier_name: {
        type: String,
        required: false
    },
    number_type_code: {
        type: Number,
        required: false
    },
    tzones: {
        type: [String],
        required: false
    },
    query_count:{
        type: Number,
        required: false
    },
    created_date: {
        type: Date,
        required: false
    },
    last_query_date: {
        type: Date,
        required: false
    }
});

var phonenumber = mongoose.model('phonenumber', phone_number_schema);
module.exports = phonenumber;