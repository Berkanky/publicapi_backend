const Joi = require("joi");

const file_intelligence_detail_service_schema = Joi.object({
  session_id: Joi.string().required().messages({
    "any.required": "session_id is required. "
  })
});

module.exports = file_intelligence_detail_service_schema;