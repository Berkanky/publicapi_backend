var crypto = require('crypto');

function random_verification_code(){
    return crypto.randomInt(100000, 1000000).toString();
};

module.exports = random_verification_code;