var mongoose = require('mongoose');

var fx_base_schema = new mongoose.Schema({
    base_currency: {
        type: String,
        required: false
    },
    quote_currency:{
        type: String,
        required: false
    },
    rate:{
        type: Number,
        required: false
    },
    source:{
        type: String,
        required: false
    },
    period:{
        type: Date,
        required: false
    }
});

var fuel_prices_schema = new mongoose.Schema({
    year:{ //2025
        type: Number,
        required: false
    },
    value: {
        type: Number,
        required: false
    },
    period:{ // new Date()
        type: Date,
        required: false
    },
    units:{ //gal - li
        type: String,
        required: false
    },
    energy_type:{ // 'GASOLINE','DIESEL','ELECTRICITY'
        type: String,
        required: false,
        enum: ['GASOLINE','DIESEL','ELECTRICITY']
    },
    grade:{ //Regular - Premium - Midgrade
        type: String,
        required: false
    },
    method: {  // 'FACTOR', 'SCRAPED', 'API'
        type: String,
        required: false
    },       
    source: { // 'ESTIMATED_FROM_GASOLINE', 'EIA', vs.
        type: String,
        required: false
    },
    created_date:{
        type: Date,
        required: false,
        default: new Date()
    },
    updated_date:{
        type: Date,
        required: false,
        default: new Date()
    },
    base_units:{
        type: String,
        required: false,
        default: "GAL"
    },
    fx: fx_base_schema
});

var country_meta_schema = new mongoose.Schema({
    country_alpha_2_code:{
        type: String,
        required: false
    },
    fuel_prices:{
        type: [fuel_prices_schema],
        required: false,
        default: []
    },
    updated_date:{
        type: Date,
        required: false
    },
    created_date: {
        type: Date,
        required: false
    }
});

var country_meta = mongoose.model("country_meta", country_meta_schema);
module.exports = country_meta;