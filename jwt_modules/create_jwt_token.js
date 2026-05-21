var jwt = require("jsonwebtoken");
var crypto = require('crypto');

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

async function create_jwt_token (req, res, expires_in, session_id, email_address, subscriber_id){

  var jti = crypto.randomUUID();

  var payload = {
    jti: jti, 
    session_id: session_id,
    email_address: email_address,
    subscriber_id: subscriber_id
  };

  var options = { 
    algorithm: JWT_TOKEN_ALGORITHM,
    issuer: ISSUER,
    audience: JWT_AUDIENCE,
    expiresIn: expires_in
  };

  try{

    var token = jwt.sign( payload, SECRET_KEY, options);
    if( !token ) return res.status(500).json({ message: 'Unexpected error generating session token. Please try again.' });
    
    return { token, jti, session_id, email_address };

  }catch(err){  
    console.error(err);
  }
};

module.exports = create_jwt_token;