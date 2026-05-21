var crypto = require('crypto');

function generate_secret_key(bytes = 32) {

    var created_secret_key = crypto.randomBytes(bytes).toString('hex');
    console.log("created_secret_key -> " + created_secret_key);
    return created_secret_key;
};

function generate_refresh_token_pepper() {
    var refresh_token_pepper = crypto.randomBytes(32).toString("hex");
    console.log(" refresh_token_pepper -> " + refresh_token_pepper);
    return refresh_token_pepper;
}

generate_refresh_token_pepper();

module.exports = { generate_secret_key, generate_refresh_token_pepper };