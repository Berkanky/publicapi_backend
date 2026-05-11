var axios = require("axios");

var { BASE_URL } = process.env;
if( !BASE_URL ) throw "BASE_URL required. ";

async function email_address_verification(req, res, next){
    
    var { email_address } = req.body;

    var email_address_intelligence_base_path = 'email-intelligence';
    
    var request_body = {
        email_address: email_address
    };
    
    var request_url = BASE_URL + '/' + email_address_intelligence_base_path;
    var res = await axios.post(request_url, request_body);

    if( res.status !== 200 ) return res.status(res.status).json({ message:' The email address is missing or incorrect.', success: false });
    if( res.data?.success !== true ) return res.status(res.status).json({ message:' The email address is missing or incorrect.', success: false });

    var { out_response } = res.data;
    var { classification, dns } = out_response;

    var { is_disposable } = classification;
    var { domain_exists, mx_exists } = dns;

    if( is_disposable || !domain_exists || !mx_exists ) return res.status(400).json({ message:' The email address is missing or incorrect.', success: false });

    return next();
};

module.exports = email_address_verification;