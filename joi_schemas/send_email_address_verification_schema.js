const Joi = require("joi");

const send_email_address_verification_schema = Joi.object({
  email_address: Joi.string().required().messages({
    "any.required": "email_address is required. "
  })
});

module.exports = send_email_address_verification_schema;