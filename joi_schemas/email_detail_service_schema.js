const Joi = require("joi");

const email_detail_service_schema = Joi.object({
  email_address: Joi.string().required().messages({
    "any.required": "email_address is required. "
  })
});

module.exports = email_detail_service_schema;