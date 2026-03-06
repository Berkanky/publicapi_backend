var mongoose = require("mongoose");

var phone_number_schema = new mongoose.Schema({
    phone_number_hash: {
        type: String,
        required: true,
        unique: true
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
    query_count: {
        type: Number,
        default: 0,
        required: false
    },
    created_date: {
        type: Date,
        required: false,
        default: Date.now
    },
    last_query_date: {
        type: Date,
        required: false,
        default: Date.now
    }
});

phone_number_schema.index({ last_query_date: -1 });
phone_number_schema.index({ phone_number_hash: -1 });

var phonenumber = mongoose.model("phonenumber", phone_number_schema);
module.exports = phonenumber;