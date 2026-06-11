var refresh_session = require("../schemas/refresh_session_schema");

var { create_refresh_token } = require("../refresh_token_modules/create_refresh_token");
var calculate_expire_date = require("../functions/calculate_expire_date");

var { 
    NODE_ENV, 
} = process.env;

if( !NODE_ENV ) throw "NODE_ENV required. ";

var refresh_token_expire_date_h = NODE_ENV === 'production' ? 720 : 1;

async function create_refresh_session(subscriber_id, session_id){

    var { created_refresh_token, hashed_refresh_token } = create_refresh_token();
    var created_date = new Date();

    var refresh_session_filter = {
        subscriber_id: subscriber_id,
        revoked_date: null,
        created_date: { $lte: created_date }
    };

    var existing_refresh_session = await refresh_session
        .findOne(refresh_session_filter)
        .sort({ created_date: -1 })
        .lean()

    if( existing_refresh_session ){
        var refresh_session_update = {
            $set: {
                revoked_date: new Date(),
                replaced_by_hash: hashed_refresh_token,
                last_used_date: new Date()
            }
        };

        var existing_refresh_session__id = existing_refresh_session._id.toString();

        await refresh_session.findByIdAndUpdate(existing_refresh_session__id, refresh_session_update);
    }

    var expired_date = calculate_expire_date({ hours: refresh_token_expire_date_h, minutes: 0 });

    var new_refresh_session_obj = {
        subscriber_id: subscriber_id,
        session_id: session_id,
        refresh_token_hash: hashed_refresh_token,
        expired_date: expired_date,
        created_date: created_date
    };

    var new_refresh_session = new refresh_session(new_refresh_session_obj);
    await new_refresh_session.save();

    return { created_refresh_token, hashed_refresh_token };
};

module.exports = create_refresh_session;