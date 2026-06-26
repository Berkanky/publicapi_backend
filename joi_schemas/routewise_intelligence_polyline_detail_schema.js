const Joi = require("joi");

const routewise_intelligence_polyline_detail_schema = Joi.object({
  _id: Joi.string().required().messages({
    "any.required": "_id is required. "
  })
});

module.exports = routewise_intelligence_polyline_detail_schema;