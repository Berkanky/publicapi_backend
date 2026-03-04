var { NODE_ENV, APP_DOMAIN } = process.env;

if( !NODE_ENV ) throw "NODE_ENV is required. ";
if( !APP_DOMAIN ) throw "APP_DOMAIN is required. ";

var is_prod = NODE_ENV === 'production';
var sameSite = is_prod ? "None" : 'lax';
var domain = is_prod ? APP_DOMAIN : null;

function clear_res_cookie(req, res, key, path){

    var cookie_options = {
        httpOnly: true,
        secure: is_prod,
        sameSite,
        path,
        domain
    };

    if( !is_prod ) delete cookie_options["domain"];
    res.clearCookie(key, cookie_options);

    return true;
};

module.exports = clear_res_cookie;