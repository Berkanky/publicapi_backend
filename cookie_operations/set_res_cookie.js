var { NODE_ENV, APP_DOMAIN } = process.env;

if( !NODE_ENV ) throw "NODE_ENV is required. ";
if( !APP_DOMAIN ) throw "APP_DOMAIN is required. ";

var is_prod = NODE_ENV === 'production';
var sameSite = is_prod ? "None" : 'lax';
var domain = is_prod ? APP_DOMAIN : null;

function set_res_cookie(req, res, key, value, duration, path){

    var cookie_options =  {
        httpOnly: true,
        secure: is_prod,       
        sameSite,      
        maxAge: duration,
        path,
        domain,
        priority: 'High'
    };

    if( !is_prod ) delete cookie_options["domain"];
    res.cookie(key, value, cookie_options);

    return true;
};

module.exports = set_res_cookie;