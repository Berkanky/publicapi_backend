const Joi = require("joi");

var google_login_service_schema = Joi.object({
  id_token: Joi.string().required().messages({
    "any.required": "Token ID is required. "
  })
});

module.exports = google_login_service_schema;