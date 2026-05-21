var crypto = require("crypto");

var { 
    REFRESH_TOKEN_PEPPER, 
    REFRESH_TOKEN_BYTES, 
    REFRESH_TOKEN_EXPIRES_DAYS
} = process.env;

function to_base64_url(buf) {
    return buf.toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
};

function hash_refresh_token(token) {
    if (!token || typeof token !== "string") throw new Error("refresh token required");
    return crypto
        .createHmac("sha256", REFRESH_TOKEN_PEPPER)
        .update(token, "utf8")
        .digest("hex");
};

function create_refresh_token() {
    var bytes = parseInt(REFRESH_TOKEN_BYTES, 10);
    if (!Number.isFinite(bytes) || bytes < 32) throw new Error("REFRESH_TOKEN_BYTES invalid (min 32).");

    var token = to_base64_url(crypto.randomBytes(bytes)); 
    var hashed_token = hash_refresh_token(token);

    return { created_refresh_token: token, hashed_refresh_token: hashed_token };
};

module.exports = {create_refresh_token, hash_refresh_token};