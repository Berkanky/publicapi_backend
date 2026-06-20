const Joi = require("joi");

const file_intelligence_service_schema = Joi.object({
  country_iso_code: Joi.string().required().messages({
    "any.required": "country_iso_code is required. "
  })
});

module.exports = file_intelligence_service_schema;