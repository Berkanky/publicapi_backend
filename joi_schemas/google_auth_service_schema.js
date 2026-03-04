const Joi = require("joi");

const google_auth_service_schema = Joi.object({
  google_id_token: Joi.string().required().messages({
    "any.required": "google_id_token is required. "
  })
});

module.exports = google_auth_service_schema;