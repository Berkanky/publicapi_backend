var mongoose = require("mongoose");

var official_language_schema = new mongoose.Schema(
    {
        language_name: {
            type: String,
            required: true,
            trim: true
        },
        language_alpha_2_code: {
            type: String,
            required: true,
            trim: true,
            lowercase: true
        },
        language_alpha_3_code: {
            type: String,
            required: true,
            trim: true,
            lowercase: true
        },
        official_status: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
            enum: ["official", "regional", "minority", "de_facto"]
        }
    }
);

var currency_schema = new mongoose.Schema(
    {
        currency_name: {
            type: String,
            required: true,
            trim: true
        },
        currency_alpha_3_code: {
            type: String,
            required: true,
            trim: true,
            uppercase: true
        },
        currency_numeric_code: {
            type: String,
            required: false,
            trim: true
        }
    }
);

var country_reference_schema = new mongoose.Schema(
    {
        country_name: {
            type: String,
            required: true,
            trim: true
        },
        official_country_name: {
            type: String,
            required: false,
            trim: true
        },
        country_alpha_2_code: {
            type: String,
            required: true,
            trim: true,
            uppercase: true,
            unique: true
        },
        country_alpha_3_code: {
            type: String,
            required: true,
            trim: true,
            uppercase: true,
            unique: true
        },
        country_numeric_code: {
            type: String,
            required: false,
            trim: true
        },
        default_locale_code: {
            type: String,
            required: false,
            trim: true
        },
        official_languages: {
            type: [official_language_schema],
            default: []
        },
        currencies: {
            type: [currency_schema],
            default: []
        },
        is_active: {
            type: Boolean,
            required: true,
        },
        created_date: {
            type: Date,
            required: true
        },
        updated_date: {
            type: Date,
            required: false
        }
    },
    {
        versionKey: false,
        collection: "country_references"
    }
);

country_reference_schema.index({ country_alpha_2_code: 1 }, { unique: true });
country_reference_schema.index({ country_alpha_3_code: 1 }, { unique: true });
country_reference_schema.index({ country_numeric_code: 1 });
country_reference_schema.index({ "official_languages.language_alpha_2_code": 1 });
country_reference_schema.index({ "official_languages.language_alpha_3_code": 1 });
country_reference_schema.index({ "currencies.currency_alpha_3_code": 1 });

var country_reference = mongoose.model("country_reference", country_reference_schema);
module.exports = country_reference;