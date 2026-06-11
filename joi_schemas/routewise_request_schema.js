var Joi = require("joi");

var location_schema = Joi.object({
    lat: Joi.number().min(-90).max(90).required(),
    lng: Joi.number().min(-180).max(180).required()
});

var routewise_request_schema = Joi.object({
    email_address: Joi.string()
        .optional(),

    avg_consumption: Joi.number()
        .min(0)
        .optional(),

    origin: location_schema.optional(),

    destination: location_schema.optional(),

    compute_alternative_routes: Joi.boolean()
        .optional(),
    
    person: Joi.number()
        .optional(),
    luggage_kg: Joi.number()
        .optional(),
    drive_type: Joi.string()
        .optional(),
    fuel_type: Joi.string()
        .optional(),
    currency: Joi.string()
        .optional(),
});

module.exports = routewise_request_schema;