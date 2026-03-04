const Joi = require("joi");

const webauthn_login_options_service_schema = Joi.object({
  user_id: Joi.string().required().messages({
    "any.required": "user_id is required. "
  }),
  response: Joi.object().required().messages({
    "any.required": "response is required. "
  })
});

module.exports = webauthn_login_options_service_schema;