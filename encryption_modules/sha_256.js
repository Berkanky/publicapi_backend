const crypto = require('crypto');

function sha_256(val){
    return crypto.createHash("sha256").update(val).digest("hex");
};

module.exports = sha_256;