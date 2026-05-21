const crypto = require("crypto");

function generate_jwt_secret_key(bytes = 64) {
    var secret_key = crypto.randomBytes(bytes).toString("base64");
    console.log("secret_key -> " + secret_key);
    return secret_key;
};

function generate_encryption_key() {
    var encryption_key = crypto.randomBytes(32).toString("base64");
    console.log("encryption_key -> " + encryption_key);
    return encryption_key;
};

generate_jwt_secret_key();
generate_encryption_key();

module.exports = { generate_jwt_secret_key, generate_encryption_key };