const Joi = require("joi");

const webauthn_login_options_service_schema = Joi.object({
  email_address: Joi.string().required().messages({
    "any.required": "email_address is required. "
  })
});

module.exports = webauthn_login_options_service_schema;