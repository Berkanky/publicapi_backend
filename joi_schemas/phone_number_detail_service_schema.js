const Joi = require("joi");

const phone_number_detail_service_schema = Joi.object({
  phone_number: Joi.string().required().messages({
    "any.required": "phone_number is required. "
  }),
  country_iso_code: Joi.string().required().messages({
    "any.required": "country_iso_code is required. "
  }),
});

module.exports = phone_number_detail_service_schema;