const Joi = require("joi");

const webauthn_register_verify_service_schema = Joi.object({
  response: Joi.object().required().messages({
    "any.required": "response is required. "
  })
});

module.exports = webauthn_register_verify_service_schema;