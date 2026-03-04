const jwt = require("jsonwebtoken");
const crypto = require('crypto');

var { JWT_SECRET_KEY, JWT_TOKEN_ALGORITHM, ISSUER, AUDIENCE } = process.env;

if (!JWT_SECRET_KEY || JWT_SECRET_KEY.length < 32) throw new Error('JWT_SECRET_KEY weak or undefined. ');
if (!JWT_TOKEN_ALGORITHM) throw new Error("JWT_TOKEN_ALGORITHM required. ");
if (!ISSUER) throw new Error("ISSUER required. ");
if (!AUDIENCE) throw new Error("AUDIENCE required. ");

var create_access_token = async (req, res, user_id, expires_in, session_id) => {

  var jti = crypto.randomUUID();

  var payload = {
    user_id: user_id, 
    jti: jti, 
    session_id: session_id,
    typ: "access"
  };

  var options = { 
    algorithm: JWT_TOKEN_ALGORITHM,
    expiresIn: expires_in,
    issuer: ISSUER,
    audience: AUDIENCE
  };

  try{

    var access_token = jwt.sign( payload, JWT_SECRET_KEY, options);
    if( !access_token ) return res.status(500).json({ message: 'Unexpected error generating session token. Please try again.' });
    
    return { access_token };
  }catch(err){
    
    console.error(err);
    var message = " Unable to generate session token. Please try again later.";
    throw message;
  }
};

module.exports = {create_access_token};