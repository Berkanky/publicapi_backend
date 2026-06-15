var mongoose = require("mongoose");

var format_schema = new mongoose.Schema({
    national:{
        type: String,
        required: false
    },
    international:{
        type: String,
        required: false
    },
    original:{
        type: String,
        required: false
    }
}, { _id: false });

var phone_number_schema = new mongoose.Schema({
    phone_number_hash: {
        type: String,
        required: true,
        unique: true
    },
    country_alpha_2_code: {
        type: String,
        required: false
    },
    sanitized_phone_number:{
        type: String,
        required: false
    },
    e164: {
        type: String,
        required: false
    },
    country_calling_code:{
        type: Number,
        required: false
    },
    carrier_name:{
        type: String,
        required: false
    },
    number_type_code: {
        type: Number,
        required: false
    },
    number_type:{
        type: String,
        required: false
    },
    is_valid:{
        type: Boolean,
        required: false
    },
    is_possible:{
        type: Boolean,
        required: false
    },
    formats:{
        type: format_schema,
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