var auditlog = require("../schemas/audit_log");

var onFinished = require('on-finished');

//Şifreleme.
var sha_256 = require("../encryption_modules/sha_256");

//Fonksiyonlar.
var get_geo_country = require("../functions/get_geo_country");

var { ISSUER } = process.env;
if( !ISSUER ) throw "ISSUER required. ";

async function update_audit_log(req, res, next){

  var { session_id, subscriber_id } = req;

  var audit_log_filter = {
    session_id: session_id,
    subscriber_id: null
  };

  var audit_log_update = {
    $set: {
      subscriber_id: subscriber_id
    }
  };

  await auditlog.updateMany(audit_log_filter, audit_log_update);
  return true;
};

async function create_audit_log(req, res, next) {

  try { 

    onFinished(res, async(err, res) => {
      if( req.path !== '/health'  ){

        var geo_country = get_geo_country(req);
        var user_agent = req.headers["user-agent"];
        var status_code = res.statusCode;
        var success = status_code > 199 && status_code < 400 ? true : false;

        var { 
          subscriber_id,
          id,
          session_id,
          action_name,
          source_ip,
          method,
          path
        } = req; 

        var new_audit_log_obj = {   
          subscriber_id: subscriber_id || null,
          request_id: id || null,
          session_id: session_id || null,
          action: action_name || null,
          success: success || null,
          http_status: status_code || null,
          ip_address: source_ip || null,
          user_agent: user_agent || null,
          geo_country: geo_country || null,
          method: method || null,
          path: path || null,
          provider: ISSUER,
        };

        var new_audit_log = new auditlog(new_audit_log_obj);
        await new_audit_log.save();
        if( subscriber_id ) await update_audit_log(req, res, next);
      }
    });
  } catch (err) { 
    console.error(err);
  } finally{
    return next();
  }
};

module.exports = create_audit_log;