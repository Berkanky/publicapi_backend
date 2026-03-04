const Joi = require("joi");

const delete_webauthn_service_schema = Joi.object({
  credential_id: Joi.string().required().messages({
    "any.required": "credential_id is required. "
  })
});

module.exports = delete_webauthn_service_schema;