var mongoose = require("mongoose");

var routewise_routes_schema = new mongoose.Schema({
    calculation_hash:{
        type: String,
        required: false
    },
    distance_km:{
        type: Number,
        required: false
    },
    duration_seconds:{
        type: Number,
        required: false
    },
    total_cost: {
        type: Number,
        required: false
    }
});

var routewiseroutes = mongoose.model("routewiseroutes", routewise_routes_schema);
module.exports = routewiseroutes;