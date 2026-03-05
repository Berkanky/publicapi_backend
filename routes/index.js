var express = require("express");
var app = express.Router();

var crypto = require('crypto');
var { OAuth2Client } = require("google-auth-library");

var {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require("@simplewebauthn/server");

//joi schemas
var google_auth_service_schema = require("../joi_schemas/google_auth_service_schema");
var webauthn_register_verify_service_schema = require("../joi_schemas/webauthn_register_verify_service_schema");
var webauthn_login_options_service_schema = require("../joi_schemas/webauthn_login_options_service_schema");
var webauthn_login_options_service_schema = require("../joi_schemas/webauthn_login_verify_service_schema");
var delete_webauthn_service_schema = require("../joi_schemas/delete_webauthn_service_schema");
var phone_number_detail_service_schema = require("../joi_schemas/phone_number_detail_service_schema");

//middlewares
var rate_limiter = require("../middleware/rate_limiter");
var set_service_action_name = require("../middleware/set_service_action_name");
var create_session_id = require("../middleware/create_session_id");
var { control_access_token } = require("../middleware/control_access_token");
var user_control = require("../middleware/user_control");

//shemas
var user = require("../schemas/user");
var phonenumber = require("../schemas/phone_number_lookups");

//insert functions
var create_refresh_session = require("../insert_operations/create_refresh_session");

//jwt
var { create_access_token } = require("../token_modules/create_access_token");
var { create_refresh_token } = require("../token_modules/create_refresh_token");

//functions
var format_date = require("../functions/format_date");

//encryptions
var aes_256_gcm_encrypt = require("../encryption_modules/aes_256_gcm_encrypt");
var aes_256_gcm_decrypt = require("../encryption_modules/aes_256_gcm_decrypt");
var sha_256 = require("../encryption_modules/sha_256");

//res-cookies
var set_res_cookie = require("../cookie_operations/set_res_cookie");
var clear_res_cookie = require("../cookie_operations/clear_res_cookie");
var { control_refresh_token } = require("../middleware/control_refresh_token");

var server_cache = require("../cache");
/* 
  await server_cache.set(key, data, timeoutms);
  await server_cache.del(key);
  await server_cache.get(key);
*/

var { 
  NODE_ENV, 
  GOOGLE_QAUTH_CLIENT_SECRET, 
  GOOGLE_QAUTH_CLIENT_ID, 
  ISSUER,
  WEBAUTHN_RP_ID,
  WEBAUTHN_ORIGIN,
  WEBAUTHN_RP_NAME
} = process.env;

if( !NODE_ENV ) throw "NODE_ENV required. ";
if( !GOOGLE_QAUTH_CLIENT_SECRET ) throw "GOOGLE_QAUTH_CLIENT_SECRET required. ";
if( !GOOGLE_QAUTH_CLIENT_ID ) throw "GOOGLE_QAUTH_CLIENT_ID required. ";
if( !ISSUER ) throw "ISSUER required. ";
if( !WEBAUTHN_RP_ID ) throw "WEBAUTHN_RP_ID required. ";
if( !WEBAUTHN_ORIGIN ) throw "WEBAUTHN_ORIGIN required. ";
if( !WEBAUTHN_RP_NAME ) throw "WEBAUTHN_RP_NAME required. ";

var is_prod = NODE_ENV === "production";
var jwt_expires_in = '15m';
var client = new OAuth2Client(GOOGLE_QAUTH_CLIENT_ID);

var challenge_store = new Map();

function set_challenge(key, challenge) {
  challenge_store.set(key, { challenge, expiresAt: Date.now() + 2 * 60 * 1000 });
};

function get_challenge(key) {

  var v = challenge_store.get(key);
  if (!v) return null;
  if (Date.now() > v.expiresAt) {
    challenge_store.delete(key);
    return null;
  }

  return v.challenge;
};

function clear_challenge(key) {
  challenge_store.delete(key);
};

//Health service.
app.get(
    "/health",
    async(req, res) => { 
        try{
          return res.status(200).json({
            issuer: ISSUER,
            success: true,
            request_date: new Date()
          });
        }catch(err){
            console.error(err);
            return res.status(500).json({ message: err, success: false });
        }
    }
);

//google-qauth
app.post(
  "/google-auth",
  rate_limiter,
  create_session_id,
  set_service_action_name({action: 'google-auth'}),
  async(req, res) => {

    var { google_id_token } = req.body;

    var { error } = google_auth_service_schema.validate(req.body, { abortEarly: false });
    if( error) return res.status(400).json({errors: error.details.map(detail => detail.message), success: false });

    var is_new_user = false;

    try{

      var ticket = await client.verifyIdToken({
        idToken: google_id_token,
        audience: GOOGLE_QAUTH_CLIENT_ID,
      });

      var payload = ticket.getPayload();

      var { 
        email, 
        name, 
        given_name, 
        family_name, 
        email_verified,
        sub
      } = payload;

      if( !email_verified ) return res.status(403).json({ message:' Email not verified.', success: false });

      var hashed_sub = sha_256(sub);

      var user_id;
      var user_filter = { email_address: email, google_sub: hashed_sub };
      var user_detail = await user.findOne(user_filter).lean();

      if( user_detail ) {

        user_id = user_detail._id.toString();

        var user_update = {
          $set:{
            active: true,
            login_date: new Date()
          }
        };
        await user.findByIdAndUpdate(user_id, user_update);

      } else if( !user_detail ){

        var new_user_obj = {
          email_address: email,
          name: given_name || null,
          surname: family_name || null,
          display_name: name || null,
          created_date: new Date(),
          login_date: new Date(),
          active: true,
          google_sub: hashed_sub
        };

        var new_user = new user(new_user_obj);
        var created_user = await new_user.save();

        user_id = created_user._id.toString();
        is_new_user = true;
      }

      req.user_id = user_id;

      var { access_token } = await create_access_token(req, res, user_id, jwt_expires_in, req.session_id);
      var { refresh_token } = create_refresh_token();
      
      set_res_cookie(req, res, "access_token", access_token, 15 * 60 * 1000, '/');
      set_res_cookie(req, res, "refresh_token", refresh_token, 30 * 24 * 60 * 60 * 1000, '/refresh-auth-session');

      var status_code = is_new_user === true ? 201 : 200;
      var message = is_new_user === true ? 'Account created.' : 'Signed in with Google.';

      req.refresh_token = refresh_token;
      await create_refresh_session(req);

      return res.status(status_code).json({ message: message, success: true, is_new_user: is_new_user });
    }catch(err){
      console.error(err);
      return res.status(500).json({ message:' google-auth service error. ', success: false });
    }
  }
);

//webauthn-register-options
app.post(
  "/webauthn-register-options",
  rate_limiter,
  control_access_token,
  user_control,
  set_service_action_name({ action: "webauthn-register-options"}),
  async(req, res) => {
    try{

      var { webauthn, email_address, display_name } = req.user_detail;

      var webauthn_array = Array.isArray(webauthn) ? webauthn : [];

      var exclude_credentials = webauthn_array
        .filter(x => x && x.credential_id)
        .map(x => ({
          id: Buffer.from(x.credential_id, "base64url"),
          type: "public-key",
          transports: Array.isArray(x.transports) ? x.transports : undefined
        }));

      var options = await generateRegistrationOptions({
        rpName: WEBAUTHN_RP_NAME,
        rpID: WEBAUTHN_RP_ID,
        userID: new TextEncoder().encode(String(req.user_id)),           
        userName: email_address,             
        userDisplayName: display_name || email_address,
        attestationType: "none",
        excludeCredentials: exclude_credentials,
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "preferred",
        }
      });

      var key = 'webauthn:reg:'+ req.user_id;

      if( is_prod ) await server_cache.set(key, options.challenge, 120);
      else set_challenge(key, options.challenge);
      
      return res.json(options);
    }catch(err){
      console.error(err);
      return res.status(500).json({ message:' webauthn-register-options service error. ', success: false });
    }
  }
);

//webauthn-register-verify
app.post(
  "/webauthn-register-verify",
  rate_limiter,
  control_access_token,
  set_service_action_name({ action: 'webauthn-register-verify'}),
  async(req, res) => {

    var { response } = req.body;

    var { error } = webauthn_register_verify_service_schema.validate(req.body, { abortEarly: false });
    if( error) return res.status(400).json({errors: error.details.map(detail => detail.message), success: false });

    try{

      var key = 'webauthn:reg:'+ req.user_id;
      var expected_challenge = is_prod ? await server_cache.get(key) : get_challenge(key);
      if (!expected_challenge) return res.status(400).json({ message: "Challenge missing/expired" });

      var verification;
      try {
        verification = await verifyRegistrationResponse({
          response,
          expectedChallenge: expected_challenge,
          expectedOrigin: WEBAUTHN_ORIGIN,
          expectedRPID: WEBAUTHN_RP_ID,
          requireUserVerification: false,
        });
      } catch (err) {
        console.error(err);
        return res.status(400).json({ message: "Registration verify failed" });
      }

      var { verified, registrationInfo } = verification;
      if (!verified || !registrationInfo) return res.status(400).json({ message: "Not verified" });

      var cred = registrationInfo.credential;

      if (!cred?.id) return res.status(400).json({ message: "Missing credential ID" });
      if (!cred?.publicKey) return res.status(400).json({ message: "Missing credential public key" });

      var new_cred_id = cred.id;
      var pubkey_b64url = Buffer.from(cred.publicKey).toString("base64url");

      var user_update = {
        $set: { updated_date: new Date() },
        $push: {
          webauthn: {
            credential_id: new_cred_id,
            public_key: pubkey_b64url,
            counter: cred.counter ?? 0,
            transports: cred.transports || response?.response?.transports || [],
          }
        }
      };

      await user.updateOne(
        { _id: req.user_id, "webauthn.credential_id": { $ne: new_cred_id } },
        user_update
      );

      if( is_prod ) await server_cache.del(key);
      else clear_challenge(key);
      
      return res.json({ message: ' Passkey successfully created.', success: true });
    }catch(err){
      console.error(err);
      return res.status(500).json({ message:' webauthn-register-verify', success: false });
    }
  }
);

//webauthn-login-options
app.post(
  '/webauthn-login-options',
  rate_limiter,
  set_service_action_name({ action: 'webauthn-login-options'}),
  async(req, res) => {

    var { email_address } = req.body;

    var { error } = webauthn_login_options_service_schema.validate(req.body, { abortEarly: false });
    if( error) return res.status(400).json({errors: error.details.map(detail => detail.message), success: false });

    try{

      var user_filter = { email_address: email_address };
      var user_detail = await user.findOne(user_filter).lean();
      if( !user_detail ) return res.status(404).json({ message:' user not found.', success: false });

      var key = 'webauthn:auth:'+ user_detail._id;

      var allow_credentials = (user_detail?.webauthn || [])
        .filter(c => c?.credential_id)
        .map(c => ({
          id: c.credential_id, 
          type: "public-key",
          transports: Array.isArray(c.transports) ? c.transports : undefined,
        }));

      var options = await generateAuthenticationOptions({
        rpID: WEBAUTHN_RP_ID,
        allowCredentials: allow_credentials,
        userVerification: "preferred",
      });

      if( is_prod ) await server_cache.set(key, options.challenge, 120);
      else set_challenge(key, options.challenge);
      
      return res.json({ success: true, options, user_id: user_detail._id });
    }catch(err){
      console.error(err);
      return res.status(500).json({ message: 'webauthn-login-options service error. ', success: false });
    }
  }
);

//webauthn-login-verify
app.post(
  '/webauthn-login-verify',
  rate_limiter,
  create_session_id,
  set_service_action_name({ action: 'webauthn-login-verify'}),
  async(req, res) => {

    var { user_id, response } = req.body;

    var { error } = webauthn_login_options_service_schema.validate(req.body, { abortEarly: false });
    if( error) return res.status(400).json({errors: error.details.map(detail => detail.message), success: false });

    try{

      var user_detail = await user.findById(user_id).lean();
      if( !user_detail ) return res.status(404).json({ message:' user not found.', success: false });

      var key = 'webauthn:auth:'+ user_detail._id;

      var expected_challenge = is_prod ? await server_cache.get(key) : get_challenge(key);
      if (!expected_challenge) return res.status(400).json({ message: "Challenge missing/expired" });

      var creds = user_detail?.webauthn || [];
      var cred_from_db = creds.find(
        (c) => c.credential_id === Buffer.from(response.id, "base64url").toString("base64url")
      ) || creds.find((c) => c.credential_id === response.id);

      if (!cred_from_db) return res.status(400).json({ message: "Unknown credential" });

      var verification;
      try {
        verification = await verifyAuthenticationResponse({
          response,
          expectedChallenge: expected_challenge,
          expectedOrigin: WEBAUTHN_ORIGIN,
          expectedRPID: WEBAUTHN_RP_ID,
          credential: {
            id: cred_from_db.credential_id,
            publicKey: Buffer.from(cred_from_db.public_key, "base64url"),
            counter: cred_from_db.counter ?? 0,
            transports: cred_from_db.transports ?? [],
          },
          requireUserVerification: false,
        });
      } catch (e) {
        return res.status(400).json({ message: "Auth verify failed" });
      }

      var { verified, authenticationInfo } = verification;
      if (!verified || !authenticationInfo) return res.status(401).json({ message: "Not verified" });
      
      await user.updateOne(
        { _id: user_detail._id, "webauthn.credential_id": cred_from_db.credential_id },
        {
          $set: {
            "webauthn.$.counter": authenticationInfo.newCounter,
            updated_date: new Date(),
            login_date: new Date(),
            active: true 
          }
        }
      );

      if( is_prod ) await server_cache.del(key);
      else clear_challenge(key);

      var { access_token } = await create_access_token(req, res, user_id, jwt_expires_in, req.session_id);
      var { refresh_token } = create_refresh_token();
      
      set_res_cookie(req, res, "access_token", access_token, 15 * 60 * 1000, '/');
      set_res_cookie(req, res, "refresh_token", refresh_token, 30 * 24 * 60 * 60 * 1000, '/refresh-auth-session');

      req.refresh_token = refresh_token;
      await create_refresh_session(req);

      return res.json({ message:' Login was successful.', success: true });
    }catch(err){
      console.error(err);
      return res.status(500).json({ message: 'webauthn-login-verify service error. ', success: false });
    }
  }
);

//webauthn-update
app.post(
  "/update-webauthn",
  rate_limiter,
  control_access_token,
  user_control,
  set_service_action_name({ action: 'update-webauthn'}),
  async(req, res) => {

    var { credential_id } = req.body;

    var { error } = delete_webauthn_service_schema.validate(req.body, { abortEarly: false });
    if( error) return res.status(400).json({errors: error.details.map(detail => detail.message), success: false });

    try{

      var { webauthn } = req.user_detail;
      
      var selected_webauthn = webauthn.find(function(item){ return item.credential_id === credential_id });
      if( !selected_webauthn ) return res.status(404).json({ message:' Credential information could not be found.', success: false });
      
      var user_filter = { _id: req.user_id, "webauthn.credential_id": credential_id };
      var user_update = {
        $set: {
          "webauthn.$.is_deleted": selected_webauthn?.is_deleted ? !selected_webauthn.is_deleted : true,
          updated_date: new Date()
        }
      };

      await user.findOneAndUpdate(user_filter, user_update);

      return res.status(200).json({ message:' webauthn updated. ', success: true });

    }catch(err){
      console.error(err);
      return res.status(500).json({ message:' update-webauthn service error. ', success: false });
    }
  }
);

//refresh-auth-session
app.get(
  "/refresh-auth-session",
  rate_limiter,
  create_session_id,
  control_refresh_token,
  set_service_action_name({action: 'refresh-auth-session'}),
  async(req, res) => {
    try{

      var { access_token } = await create_access_token(req, res, req.user_id, jwt_expires_in, req.session_id);      
      set_res_cookie(req, res, "access_token", access_token, 15 * 60 * 1000, '/');

      var refresh_token_expires_in_seconds = req.refresh_token_expires_in_seconds;
      var refresh_token_expires_in_minutes = req.refresh_token_expires_in_minutes;

      var refresh_session_details = { refresh_token_expires_in_minutes, refresh_token_expires_in_seconds };

      return res.status(200).json({ message:' The session has been successfully renewed.', success: true });
    }catch(err){
      console.error(err);
      return res.status(500).json({ message:' refresh-auth-session service error. ', success: false });
    }
  }
);

//get-user-details
app.get(
  "/user-details",
  rate_limiter,
  control_access_token,
  user_control,
  set_service_action_name({action: 'user-details'}),
  async(req, res) => {
    try{  

      var user_detail = req.user_detail;

      user_detail.created_date = format_date(String(user_detail.created_date));
      user_detail.login_date = format_date(String(user_detail.login_date));

      user_detail.access_token_expires_in_seconds = req.access_token_expires_in_seconds;
      user_detail.access_token_expires_in_minutes = req.access_token_expires_in_minutes;

      if( user_detail.last_login_date ) user_detail.last_login_date = format_date(String(user_detail.last_login_date));
      if( user_detail.updated_date ) user_detail.updated_date = format_date(String(user_detail.updated_date));

      return res.status(200).json({ message: ' User information has been successfully retrieved.', success: true, user_detail: user_detail });
    }catch(err){
      console.error(err);
      return res.status(500).json({ message:' user-details service error. '});
    }
  }
);

//logout
app.put(
  "/auth-logout",
  rate_limiter,
  control_access_token,
  set_service_action_name({action: 'auth-logout'}),
  async(req, res) => {
    try{  

      var user_update = {
        $set:{
          last_login_date: new Date(),
          active: false
        },
        $unset:{
          login_date: ''
        }
      };

      await user.findByIdAndUpdate(req.user_id, user_update);

      clear_res_cookie(req, res, 'access_token', '/');
      clear_res_cookie(req, res, 'refresh_token', '/refresh-auth-session');

      return res.status(200).json({ message:' The session has been successfully ended. ', success: true });
    }catch(err){
      console.error(err);
      return res.status(500).json({ message:' auth-logout service error. ', success: false });
    }
  }
);

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

async function update_phone_number(hashed_format_number_e164){

  var phone_number_filter = { phone_number_hash: hashed_format_number_e164 };
  var phone_number_update = {
    $set: {
      last_query_date: new Date()
    },
    $inc: { query_count: 1 }
  };

  var updated_phone_number_result = await phonenumber.findOneAndUpdate(phone_number_filter, phone_number_update);
  return updated_phone_number_result;
};

app.post(
  "/phone/lookup",
  rate_limiter,
  create_session_id,
  set_service_action_name({action: 'phonenumber-detail'}),
  async(req, res) => {

    var { phone_number, country_iso_code } = req.body;

    var { error } = phone_number_detail_service_schema.validate(req.body, { abortEarly: false });
    if( error) return res.status(400).json({errors: error.details.map(detail => detail.message), success: false });

    try{

      var sanitized_phone_number = sanitize_phone_input(phone_number);
      var sanitized_country_iso_code = sanitize_country_iso_code(country_iso_code);

      var phone_number_raw_detail = phoneUtil.parseAndKeepRawInput(sanitized_phone_number, sanitized_country_iso_code);

      var is_valid_for_region = phoneUtil.isValidNumberForRegion(phone_number_raw_detail, sanitized_country_iso_code);
      if( !is_valid_for_region ) return res.status(422).json({ message:' Phone number is not valid for the provided region.', success: false });

      var format_number_e164 = phoneUtil.format(phone_number_raw_detail, PNF.E164);

      var hashed_format_number_e164 = sha_256(format_number_e164);
      req.phone_number_hash = hashed_format_number_e164;

      var cache_key = 'phone_detail:' + hashed_format_number_e164;
      var cached_response = await server_cache.get(cache_key);
      if( cached_response ) {

        await update_phone_number(hashed_format_number_e164);

        res.set("X-Cache", "HIT");
        return res.status(200).json({ success: true, response: cached_response });
      }

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

      var update_result = await update_phone_number(hashed_format_number_e164);
      if( !update_result ) {

        var new_phone_number_obj = {
          phone_number_hash: hashed_format_number_e164,
          country_iso_code: sanitized_country_iso_code,
          region_code: region_code,
          carrier_name: carrier_name,
          number_type_code: number_type,
          tzones: tzones,
          query_count: 1,
          created_date: new Date(),
          last_query_date: new Date()
        };

        var new_phone_number = new phonenumber(new_phone_number_obj);
        await new_phone_number.save();
      }

      res.set("X-Cache", "MISS");
      return res.status(200).json({ success: true, response });
    }catch(err){
      console.error(err);
      return res.status(500).json({ message:' phonenumber-detail service error. ', success: false });
    }
  }
);

module.exports = app;