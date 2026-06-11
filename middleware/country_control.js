var find_country_by_lat_lng = require("../functions/country_finder");

var country_reference = require("../schemas/country_reference_schema");
var country_meta = require("../schemas/country_meta_schema");

async function country_control(req, res, next){
    var { origin, destination } = req.body;

    var { country_alpha_2_code, country_alpha_3_code } = find_country_by_lat_lng(origin.lat, origin.lng);
    var destination_country_alpha_2_code = find_country_by_lat_lng(destination.lat, destination.lng).country_alpha_2_code;

    if( country_alpha_2_code !== destination_country_alpha_2_code ) return res.status(400).json({ message:' Route calculations can only be performed for locations within the same country.', success: false});

    var country_reference_filter = { country_alpha_2_code: country_alpha_2_code };

    var country_reference_detail = await country_reference.findOne(country_reference_filter).lean();
    if( !country_reference_detail ) return res.status(404).json({ message:' The selected country could not be found. ', success: false});

    var { currencies, country_name,  } = country_reference_detail;

    //bu 3 satır sadece countrymeta'da var mı kontrolü.
    var country_meta_filter = { country_alpha_2_code: country_alpha_2_code };
    var country_meta_detail = await country_meta.findOne(country_meta_filter).lean();
    if( !country_meta_detail ) return res.status(404).json({ message:' The selected country could not be found. ', success: false});

    var selected_location_currency_code = currencies.length > 0 ? currencies[0]["currency_alpha_3_code"] : null;
    if( !selected_location_currency_code ) return res.status(404).json({ message:' Information about the country where the transaction is to be processed could not be retrieved.', success: false });

    req.selected_location_currency_code = selected_location_currency_code;
    req.country_name = country_name;
    req.country_alpha_3_code = country_alpha_3_code;
    req.country_alpha_2_code = country_alpha_2_code;
    
    return next();
};

module.exports = country_control;