var { NODE_ENV, APP_DOMAIN } = process.env;

if( !NODE_ENV ) throw "NODE_ENV required. ";
if( !APP_DOMAIN ) throw "APP_DOMAIN required. ";

var is_prod = NODE_ENV === 'production';
var domain = is_prod ? APP_DOMAIN : null;
var same_site = is_prod ? "None" : 'lax';

function set_res_cookie(req, res, key, value, duration, path){
    var cookie_options =  {
        httpOnly: true,
        secure: is_prod,       
        sameSite: same_site,      
        maxAge: duration,
        path,
        domain,
        priority: 'High'
    };

    console.log("cookie_options -> " + JSON.stringify(cookie_options));

    if( !is_prod ) delete cookie_options["domain"];
    res.cookie(key, value, cookie_options);

    return;
};

module.exports = set_res_cookie;