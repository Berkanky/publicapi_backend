var crypto = require('crypto');

function sha_256(value){

    if(value === undefined || value === null) throw new Error('sha_256 -> value is required.');
    return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
};

module.exports = sha_256;