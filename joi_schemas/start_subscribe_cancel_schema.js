const Joi = require("joi");

const start_subscribe_cancel_schema = Joi.object({
  email_address: Joi.string().required().messages({
    "any.required": "email_address is required. "
  })
});

module.exports = start_subscribe_cancel_schema;