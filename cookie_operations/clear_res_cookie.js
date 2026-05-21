var { NODE_ENV, APP_DOMAIN } = process.env;

if( !NODE_ENV ) throw "NODE_ENV required. ";
if( !APP_DOMAIN ) throw "APP_DOMAIN required. ";

var is_prod = NODE_ENV === 'production';
var domain = is_prod ? APP_DOMAIN : null;
var same_site = is_prod ? "None" : 'lax';

function clear_res_cookie(req, res, key, path){

    var cookie_options = {
        httpOnly: true,
        secure: is_prod,
        sameSite: same_site,
        path,
        domain
    };

    if( !is_prod ) delete cookie_options["domain"];
    res.clearCookie(key, cookie_options);

    return;
};

module.exports = clear_res_cookie;