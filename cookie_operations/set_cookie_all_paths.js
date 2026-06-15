var set_res_cookie = require("./set_res_cookie");

function set_cookie_all_paths(req, res, key, token, jwt_token_cookie_expire_date_ms){
    var authenticated_paths = [
        "/subscribe-cancel",
        "/email-address-verification",
        "/news-intelligence",
        "/login-verify",
        "/refresh",
        "/logout",
        "/subscribe-detail",
        "/route-intelligence-status-detail",
        "/auth",
        "/session-control",
        "/route-intelligence-detail",
        "/route-intelligence",
        "/route-history",
        "/phonenumber-intelligence"
    ];

    for(var i = 0; i < authenticated_paths.length; i++){
        var path = authenticated_paths[i];
        set_res_cookie(req, res, key, token, jwt_token_cookie_expire_date_ms, path);
        continue;
    };  

    return true;
};

module.exports = set_cookie_all_paths;