var jwt = require("jsonwebtoken");

var extract_jwt_token = require("../jwt_modules/extract_jwt_token");
var format_date = require("../functions/format_date");

var { 
    NODE_ENV, 
    SECRET_KEY, 
    ISSUER, 
    JWT_AUDIENCE, 
    JWT_TOKEN_ALGORITHM
} = process.env;

if( !NODE_ENV ) throw "NODE_ENV required. ";
if( !SECRET_KEY ) throw "SECRET_KEY required. ";
if( !ISSUER ) throw "ISSUER required. ";
if( !JWT_AUDIENCE ) throw "JWT_AUDIENCE required. ";
if( !JWT_TOKEN_ALGORITHM ) throw "JWT_TOKEN_ALGORITHM required. ";

var options = {
  algorithms: [JWT_TOKEN_ALGORITHM],
  issuer: ISSUER,
  audience: JWT_AUDIENCE,          
  clockTolerance: 5
};

async function verify_jwt_token (req, res, next) {

  var jwt_token = extract_jwt_token(req);
  if( !jwt_token) return res.status(401).json({ message:' Session token required.', success: false });

  try{
    var decoded = jwt.verify(jwt_token, SECRET_KEY, options);

    req.session_id = decoded.session_id;
    req.jti = decoded.jti;
    req.email_address = decoded.email_address;
    req.jwt_token = jwt_token;
    req.subscriber_id = decoded.subscriber_id;
    
    req.session_end_date = format_date(String(new Date(decoded.exp * 1000)));
    req.session_start_date = format_date(String(new Date(decoded.iat * 1000)));

    console.log("JWT Token verified. " + JSON.stringify(decoded));

    return next();
  }catch (err) {
    console.error(err);
    return res.status(401).json({ message: "Your session token is invalid or has expired. Please log in again.", success: false });
  }
};

module.exports = verify_jwt_token;