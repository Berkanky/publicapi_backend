const Joi = require("joi");

const news_intelligence_service_schema = Joi.object({
  start_date: Joi.string().optional(),
  end_date: Joi.string().optional(),
  country_iso_code: Joi.string().required().messages({
    "any.required": "country_iso_code is required. "
  }),
  category: Joi.string().required().messages({
    "any.required": "category is required. "
  }),
  page_size: Joi.number().optional(),
  page:Joi.number().optional(),
  sort_by:Joi.string().optional(),
  frequency: Joi.string().optional()
});

module.exports = news_intelligence_service_schema;