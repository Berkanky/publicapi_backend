const Joi = require("joi");

const file_intelligence_service_schema = Joi.object({
  default_locale_code: Joi.string().required().messages({
    "any.required": "default_locale_code is required. "
  })
});

module.exports = file_intelligence_service_schema;