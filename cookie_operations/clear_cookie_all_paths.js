var clear_res_cookie = require("./clear_res_cookie");

function clear_cookie_all_paths(req, res, key) {
    var paths = [
        "/",
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
        "/phonenumber-intelligence",
        "/email-intelligence",
        "/file-intelligence",
        "/file-intelligence-detail"
    ];

    for (var i = 0; i < paths.length; i++) {
        clear_res_cookie(req, res, key, paths[i]);
    };

    return;
};

module.exports = clear_cookie_all_paths;