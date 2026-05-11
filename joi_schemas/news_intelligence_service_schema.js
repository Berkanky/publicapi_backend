const Joi = require("joi");

const news_intelligence_service_schema = Joi.object({
  email_address: Joi.string().required().messages({
    "any.required": "email_address is required. "
  }),
  start_date: Joi.string().optional(),
  end_date: Joi.string().optional(),
  default_locale_code: Joi.string().required().messages({
    "any.required": "default_locale_code is required. "
  }),
  category: Joi.string().required().messages({
    "any.required": "category is required. "
  }),
  page_size: Joi.number().optional(),
  page:Joi.number().optional(),
  sort_by:Joi.string().optional(),
});

module.exports = news_intelligence_service_schema;