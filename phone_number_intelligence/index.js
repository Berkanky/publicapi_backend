var express = require("express");
var app = express.Router();

var crypto = require('crypto');

//joi schemas
var phone_number_detail_service_schema = require("../joi_schemas/phone_number_detail_service_schema");

//middlewares
var rate_limiter = require("../middleware/rate_limiter");
var set_service_action_name = require("../middleware/set_service_action_name");
var create_session_id = require("../middleware/create_session_id");

//shemas
var phonenumber = require("../schemas/phone_number_lookups");

//encryptions
var sha_256 = require("../encryption_modules/sha_256");

var server_cache = require("../cache");

/*
  await server_cache.set(key, data, timeoutms);
  await server_cache.del(key);
  await server_cache.get(key);
*/

//Phone Number Details Service.
var PNF = require('google-libphonenumber').PhoneNumberFormat;
var phoneUtil = require('google-libphonenumber').PhoneNumberUtil.getInstance();

var libphonenumber_js = require("libphonenumber-js");
var parse_phone_number_from_string = libphonenumber_js.parsePhoneNumberFromString;
var { geocoder, carrier, timezones } = require('libphonenumber-geo-carrier');

function map_number_type(number_type_code) {
  var m = {
    0: "FIXED_LINE",
    1: "MOBILE",
    2: "FIXED_LINE_OR_MOBILE",
    3: "TOLL_FREE",
    4: "PREMIUM_RATE",
    5: "SHARED_COST",
    6: "VOIP",
    7: "PERSONAL_NUMBER",
    8: "PAGER",
    9: "UAN",
    10: "VOICEMAIL",
    "-1": "UNKNOWN"
  };

  return m[number_type_code] || "UNKNOWN";
};

function map_country_code_source(source_code) {

  if (source_code === null || source_code === undefined) return "UNSPECIFIED";

  if (typeof source_code === "string") return source_code;

  var m = {
    0: "UNSPECIFIED",
    1: "FROM_NUMBER_WITH_PLUS_SIGN",
    5: "FROM_NUMBER_WITH_IDD",
    10: "FROM_NUMBER_WITHOUT_PLUS_SIGN",
    20: "FROM_DEFAULT_COUNTRY"
  };

  return m[source_code] || "UNSPECIFIED";
};

function sanitize_phone_input(v) {
  if (!v) return "";
  v = String(v).trim();
  v = v.replace(/[^\d+]/g, ""); // sadece rakam ve +
  // birden fazla + varsa saçma, tek bırak
  if (v.indexOf("+") > 0) v = v.replace(/\+/g, "");
  if (v.indexOf("++") !== -1) v = v.replace(/\++/g, "+");
  return v;
};

function sanitize_country_iso_code(v) {

  if (!v) return null;

  v = String(v).trim();

  v = v.replace(/[^a-zA-Z]/g, "");

  if (!v) return null;

  v = v.toUpperCase();

  v = v.slice(0, 2);

  if (v.length !== 2) return null;

  return v;
};

async function update_phone_number(req, response){
  await phonenumber.findOneAndUpdate(
    { phone_number_hash: req.phone_number_hash },
    {
      $set: {
        last_query_date: new Date()
      },
      $inc: {
        query_count: 1
      },
      $setOnInsert: {
        phone_number_hash: req.phone_number_hash,
        country_iso_code: response?.input?.sanitized_country_iso_code,
        region_code: response?.core?.region_code,
        carrier_name: response?.enrichment?.carrier_name,
        number_type_code: response?.core?.number_type_code,
        tzones: response?.enrichment?.tzones,
        created_date: new Date()
      }
    },
    { upsert: true, new: true }
  );
};

async function resolve_phone_lookup(req){

  var { phone_number, country_iso_code } = req.body;

  var sanitized_phone_number = sanitize_phone_input(phone_number);
  var sanitized_country_iso_code = sanitize_country_iso_code(country_iso_code);

  var phone_number_raw_detail = phoneUtil.parseAndKeepRawInput(sanitized_phone_number, sanitized_country_iso_code);

  var is_valid_for_region = phoneUtil.isValidNumberForRegion(phone_number_raw_detail, sanitized_country_iso_code);
  if( !is_valid_for_region ) return { message:' Phone number is not valid for the provided region.', success: false, http_status: 422, response: {} };

  var format_number_e164 = phoneUtil.format(phone_number_raw_detail, PNF.E164);

  var hashed_format_number_e164 = sha_256(format_number_e164);
  req.phone_number_hash = hashed_format_number_e164;

  var cache_key ='phone_lookup:' + hashed_format_number_e164;

  var cached_response = await server_cache.get(cache_key);
  if( cached_response ) return { success: true, http_status: 200, cache: "HIT", response: cached_response };

  var country_code = phone_number_raw_detail.getCountryCode();
  var national_number = phone_number_raw_detail.getNationalNumber();

  var country_code_source = phone_number_raw_detail.getCountryCodeSource();
  var country_code_source_detail = map_country_code_source(Number(country_code_source));

  var raw_input = phone_number_raw_detail.getRawInput();

  var is_possible_number = phoneUtil.isPossibleNumber(phone_number_raw_detail);
  var is_valid_number = phoneUtil.isValidNumber(phone_number_raw_detail);
  var region_code = phoneUtil.getRegionCodeForNumber(phone_number_raw_detail);

  var number_type = phoneUtil.getNumberType(phone_number_raw_detail);
  var number_type_detail = map_number_type(number_type);

  var format_number = phoneUtil.formatInOriginalFormat(phone_number_raw_detail, sanitized_country_iso_code);
  var format_number_national = phoneUtil.format(phone_number_raw_detail, PNF.NATIONAL);
  var format_number_international = phoneUtil.format(phone_number_raw_detail, PNF.INTERNATIONAL);

  var fixed_line_number = parse_phone_number_from_string(format_number_international);

  var location = await geocoder(fixed_line_number) || null;
  var carrier_name = await carrier(fixed_line_number) || null; 
  var tzones = await timezones(fixed_line_number) || [];

  var response = {
    input: {
      phone_number: raw_input,
      sanitized_phone_number: sanitized_phone_number,
      country_iso_code: country_iso_code,
      sanitized_country_iso_code: sanitized_country_iso_code
    },
    core: {
      e164: format_number_e164,
      country_calling_code: country_code,
      region_code: region_code,
      national_number: national_number,
      is_possible: is_possible_number,
      is_valid: is_valid_number,
      number_type_code: number_type,
      number_type: number_type_detail,
      country_source_code: country_code_source,
      country_source: country_code_source_detail,
    },
    formats: {
      national: format_number_national,
      international: format_number_international,
      original: format_number
    },
    enrichment: {
      is_valid: is_valid_for_region,
      location: location,
      carrier_name: carrier_name,
      tzones: tzones
    }
  };

  await server_cache.set(cache_key, response, 86400);

  return { success: true, http_status: 200, cache: "MISS", response: response };
};

// -> /phone/lookup //country_iso_code -> 'tr'
app.post(
  "/phone/lookup",
  rate_limiter,
  create_session_id,
  set_service_action_name({action: 'phone-lookup'}),
  async(req, res) => {

    var { error } = phone_number_detail_service_schema.validate(req.body, { abortEarly: false });
    if( error) return res.status(400).json({errors: error.details.map(detail => detail.message), success: false });

    try{

      var { success, http_status, cache, response } = await resolve_phone_lookup(req);
      
      if( success === true ) await update_phone_number(req, response);

      res.set("X-Cache", cache);
      return res.status(http_status).json({ success: success, out_response: response });
    }catch(err){
      console.error(err);
      return res.status(500).json({ message:' phone-lookup service error. ', success: false });
    }
  }
);

module.exports = app;