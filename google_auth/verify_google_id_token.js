// auth.js
var { OAuth2Client } = require('google-auth-library');
var jwt = require("jsonwebtoken");

var { 
    GOOGLE_CLOUD_CLIENT_ID, 
    GOOGLE_CLOUD_CLIENT_SECRET 
} = process.env;

if( !GOOGLE_CLOUD_CLIENT_ID ) throw "GOOGLE_CLOUD_CLIENT_ID required. ";
if( !GOOGLE_CLOUD_CLIENT_SECRET ) throw "GOOGLE_CLOUD_CLIENT_SECRET required. ";

var google_client = new OAuth2Client(GOOGLE_CLOUD_CLIENT_ID);

async function verify_google_id_token(id_token) {

    var idToken = id_token;
    console.log(idToken);

    console.log("ENV GOOGLE_CLOUD_CLIENT_ID ->", GOOGLE_CLOUD_CLIENT_ID);
    console.log("ENV GOOGLE_CLOUD_CLIENT_SECRET ->", GOOGLE_CLOUD_CLIENT_SECRET);

    var ticket = await google_client.verifyIdToken({
        idToken,
        audience: GOOGLE_CLOUD_CLIENT_ID
    });

    var payload = ticket.getPayload();

    console.log("Google Payload -> " + JSON.stringify(payload));
    console.log("ENV GOOGLE_CLOUD_CLIENT_ID ->", GOOGLE_CLOUD_CLIENT_ID);
    console.log("TOKEN AUD ->", payload.aud);
    
    return {
        google_id: payload.sub,
        email_address: payload.email,
        name: payload.given_name,
        surname: payload.family_name,
        profile_picture: payload.picture,
        picture: payload.picture,
        email_verified: payload.email_verified,
        iat: payload.iat,
        exp: payload.exp,
        full_name: payload.name
    };
};

module.exports = verify_google_id_token;