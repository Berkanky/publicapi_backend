var refresh_session = require("../schemas/refresh_session");

var { hash_refresh_token } = require("../token_modules/create_refresh_token");
var sha_256 = require("../encryption_modules/sha_256");

var extract_service_refresh_token = require("../functions/extract_service_refresh_token");

async function control_refresh_token(req, res, next){

    var refresh_token = extract_service_refresh_token(req);
    if( !refresh_token ) return res.status(404).json({ message:' refresh_token required. ', success: false });

    var hashed_refresh_token = hash_refresh_token(refresh_token);
    var refresh_session_filter = { refresh_token_hash: hashed_refresh_token };

    var refresh_session_detail = await refresh_session.findOne(refresh_session_filter).lean();
    if( !refresh_session_detail ) return res.status(403).json({ message:' invalid refresh token. ', success: false });

    var { _id, revoked_date,  expired_date } = refresh_session_detail;
    if( revoked_date || expired_date < new Date() ) {
        
        var refresh_session_update = {
            $set:{
                revoked_date: new Date(),
                is_revoked: true,
                revoke_reason: "Your session has expired."
            }
        };

        await refresh_session.findByIdAndUpdate(_id, refresh_session_update);
        
        return res.status(401).json({ message: " Refresh token expired or revoked." });
    } else {  

        var refresh_session_update = {
            $set:{
                last_used_date: new Date(),
                session_id: sha_256(req.session_id)
            }
        };

        await refresh_session.findByIdAndUpdate(_id, refresh_session_update);

        req.user_id = refresh_session_detail.user_id;

        var now = Date.now();
        var diff_ms = new Date(String(refresh_session_detail.expired_date)).getTime() - now;

        req.refresh_token_expires_in_seconds = Math.floor(diff_ms / 1000);
        req.refresh_token_expires_in_minutes = Math.floor(diff_ms / (60 * 1000));

        return next();
    }
};

module.exports = { control_refresh_token };