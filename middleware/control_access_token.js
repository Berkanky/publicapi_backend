const jwt = require("jsonwebtoken");

var extract_service_token = require("../functions/extract_service_token");

var {
  JWT_SECRET_KEY,
  JWT_TOKEN_ALGORITHM,
  ISSUER,
  AUDIENCE,
} = process.env;

if (!JWT_SECRET_KEY || JWT_SECRET_KEY.length < 32) throw new Error("JWT_SECRET_KEY weak or undefined.");

function control_access_token(req, res, next) {
  try {

    var token = extract_service_token(req);
    if (!token) return res.status(401).json({ message: "Missing access token." });

    var payload = jwt.verify(token, JWT_SECRET_KEY, {
      algorithms: [JWT_TOKEN_ALGORITHM],
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    if (payload.typ !== "access") return res.status(401).json({ message: "Invalid token type." });

    req.session_id = payload.session_id;
    req.user_id = payload.user_id;
    req.typ = payload.typ;

    var now = Math.floor(Date.now() / 1000);
    var remaining_seconds = payload.exp - now;
    var remaining_minutes = Math.floor(remaining_seconds / 60);

    req.access_token_expires_in_seconds = remaining_seconds;
    req.access_token_expires_in_minutes = remaining_minutes;

    return next();
  } catch (err) {
    console.error(err);
    
    if (err.name === "TokenExpiredError") return res.status(401).json({ message: "Access token expired." });
    return res.status(401).json({ message: "Invalid access token." });
  }
};

module.exports = { control_access_token };