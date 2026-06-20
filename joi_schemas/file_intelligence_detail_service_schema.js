const Joi = require("joi");

const file_intelligence_detail_service_schema = Joi.object({
  _id: Joi.string().required().messages({
    "any.required": "_id is required. "
  })
});

module.exports = file_intelligence_detail_service_schema;