var refresh_session = require("../schemas/refresh_session");
var { hash_refresh_token } = require("../token_modules/create_refresh_token");
var sha_256 = require("../encryption_modules/sha_256");

var { NODE_ENV } = process.env;
if( !NODE_ENV ) throw "NODE_ENV required. ";

var is_prod = NODE_ENV === "production" ? true : false;
var expired_date = is_prod ? 24 * 60 * 60 * 1000 : 5 * 60 * 1000;

async function create_refresh_session(req){

    var refresh_session_filter = { user_id: req.user_id, is_revoked: false };
    var refresh_sessions = await refresh_session.find(refresh_session_filter);

    for(var i = 0; i < refresh_sessions.length; i++){
        var refresh_session_row = refresh_sessions[i];

        var refresh_session_row_id = refresh_session_row._id.toString();
        var refresh_session_update = {
            $set: {
                revoked_date: new Date(),
                is_revoked: true,
                revoke_reason: "A new session has been started."
            }
        };
        await refresh_session.findByIdAndUpdate(refresh_session_row_id, refresh_session_update);
    };

    var new_refresh_session_obj = {
        user_id: req.user_id,
        session_id: sha_256(req.session_id),
        refresh_token_hash: hash_refresh_token(req.refresh_token),
        expired_date: new Date(new Date().getTime() + expired_date),
        created_date: new Date(),
        is_revoked: false
    };

    var new_refresh_session = new refresh_session(new_refresh_session_obj);
    await new_refresh_session.save();

    return true;
};

module.exports = create_refresh_session;