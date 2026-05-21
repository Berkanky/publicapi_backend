const Joi = require("joi");

const email_address_verification_schema = Joi.object({
  email_address: Joi.string().required().messages({
    "any.required": "email_address is required. "
  }),
  verification_code: Joi.number().required().messages({
    "any.required": "verification_code is required. "
  })
});

module.exports = email_address_verification_schema;