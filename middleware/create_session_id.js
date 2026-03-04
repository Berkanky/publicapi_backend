const crypto = require('crypto');

async function create_session_id(req, res, next){
    var session_id = crypto.randomUUID();
    req.session_id = session_id;
    return next();
};

module.exports = create_session_id;