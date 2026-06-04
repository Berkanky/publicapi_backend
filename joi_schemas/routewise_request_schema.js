var Joi = require("joi");

var location_schema = Joi.object({
    lat: Joi.number().min(-90).max(90).required(),
    lng: Joi.number().min(-180).max(180).required()
});

var routewise_request_schema = Joi.object({
    email_address: Joi.string()
        .optional(),
    subscriber_id: Joi.string().hex().length(24).optional(),

    session_id: Joi.string()
        .trim()
        .max(255)
        .optional(),

    request_hash: Joi.string()
        .trim()
        .max(255)
        .optional(),

    created_date: Joi.date()
        .optional(),

    avg_consumption: Joi.number()
        .min(0)
        .optional(),

    origin: location_schema.optional(),

    destination: location_schema.optional(),

    travel_mode: Joi.string()
        .valid(
            "DRIVE",
            "TWO_WHEELER",
            "BICYCLE",
            "WALK",
            "TRANSIT"
        )
        .optional(),

    routing_preference: Joi.string()
        .valid(
            "TRAFFIC_AWARE",
            "TRAFFIC_AWARE_OPTIMAL",
            "TRAFFIC_UNAWARE"
        )
        .optional(),

    compute_alternative_routes: Joi.boolean()
        .optional(),
    
    person: Joi.number()
        .optional(),
    luggage: Joi.number()
        .optional(),
    drive_type: Joi.string()
        .optional(),
    fuel_type: Joi.string()
        .optional(),
    currency: Joi.string()
        .optional(),
});

module.exports = routewise_request_schema;