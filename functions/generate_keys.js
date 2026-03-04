const crypto = require("crypto");

function generate_jwt_secret_key(bytes = 64) {
    var secret_key = crypto.randomBytes(bytes).toString("base64");
    console.log(secret_key);
    return secret_key;
};

function generate_encryption_key() {
    var secret_key = crypto.randomBytes(32).toString("base64");
    console.log(secret_key);
    return secret_key;
};

module.exports = { generate_jwt_secret_key, generate_encryption_key };