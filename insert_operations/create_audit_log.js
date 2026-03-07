var auditlog = require("../schemas/audit_log");

var onFinished = require('on-finished');

//Şifreleme.
var sha_256 = require("../encryption_modules/sha_256");

//Fonksiyonlar.
var get_geo_country = require("../functions/get_geo_country");

var { ISSUER } = process.env;
if( !ISSUER ) throw "ISSUER required. ";

async function create_audit_log(req, res, next) {

  try { 

    onFinished(res, async(err, res) => {
      if( req.path !== '/health'  ){
        
        var new_audit_log_obj = {   
          request_id: req?.id || null,
          session_id: req?.session_id ? sha_256(req.session_id) : null,
          action: req?.action_name || null,
          success: res?.statusCode > 199 && res.statusCode < 400 ? true : false,
          http_status: res?.statusCode || null,
          ip_address: req?.source_ip || null,
          user_agent: req.headers["user-agent"],
          geo_country: get_geo_country(req),
          method: req?.method || null,
          path: req?.path || null,
          provider: ISSUER,
        };

        if( req.path === '/phone/lookup' ) new_audit_log_obj.phone_number_hash = req?.phone_number_hash || null;

        var new_audit_log = new auditlog(new_audit_log_obj);
        await new_audit_log.save();
      }
    });
  } catch (err) { 
    console.error(err);
  } finally{

    return next();
  }
};

module.exports = create_audit_log;