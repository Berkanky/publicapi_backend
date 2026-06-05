var mongoose = require("mongoose");

var location_schema = new mongoose.Schema({
    lat:{
        type: Number,
        required: false
    },
    lng:{
        type: Number,
        required: false
    }
},{ _id: false });

var fuel_price_schema = new mongoose.Schema({
    year: {
        type: Number,
        required: false
    },
    period: {
        type: Date,
        required: false
    },
    value: {
        type: Number,
        required: false
    }
}, { _id: false });

var currency_schema = new mongoose.Schema({
    period: {
        type: Date,
        required: false
    },
    base_currency:{
        type: String,
        required: false
    },
    rate: {
        type: Number,
        required: false
    },
    selected_currency:{
        type: String,
        required: false
    }
}, { _id: false });

var routewise_request_schema = new mongoose.Schema({
    subscriber_id:{
        type: mongoose.Schema.Types.ObjectId,
        required: false,
        ref: 'subscribers'
    },
    route_description:{
        type: String,
        required: false
    },
    session_id:{
        type: String,
        required: false
    },
    job_id:{
        type: String,
        required: false
    },
    request_hash:{
        type: String,
        required: false
    },
    calculation_hash:{
        type: String,
        required: false
    },
    currency_hash:{
        type: String,
        required: false
    },
    fuel_price_hash:{
        type: String,
        required: false
    },
    created_date: {
        type: Date,
        required: false
    },
    avg_consumption:{
        type: Number,
        required: false
    },
    origin:{
        type: location_schema,
        required: false
    },
    destination:{
        type: location_schema,
        required: false
    },
    travel_mode:{
        type: String,
        required: false
    },
    routing_preference:{
        type: String,
        required: false
    },
    compute_alternative_routes:{
        type: Boolean,
        required: false
    },
    person: {
        type: Number,
        required: false
    },
    luggage_kg: {
        type: Number,
        required: false
    },
    drive_type: {
        type: String,
        required: false
    },
    fuel_type: {
        type: String,
        required: false
    },
    fuel_price:{
        type: fuel_price_schema,
        requird: false
    },
    country_name: {
        type: String,
        required: false
    },
    status: {
        type: String,
        required: false
    },
    currency:{
        type: currency_schema,
        required: false
    },
    alternative_routes_count:{
        type: Number,
        required: false
    },
    is_clone:{
        type: Boolean,
        required: false,
        default: false
    }
});

var routewiserequest = mongoose.model("routewiserequest", routewise_request_schema);
module.exports = routewiserequest;