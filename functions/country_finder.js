var turf = require("@turf/turf");
var fs = require("fs");
var path = require("path");

var countries_path = path.join(__dirname, "../metadata/countries.geojson");
var countries = JSON.parse(fs.readFileSync(countries_path, "utf8"));

function find_country_by_lat_lng(lat, lng) {
    var point = turf.point([lng, lat]);

    for (var i = 0; i < countries.features.length; i++) {
        var country = countries.features[i];

        var is_inside = turf.booleanPointInPolygon(point, country);

        if (is_inside) {
            return {
                country_name: country.properties.name,
                country_alpha_2_code: country.properties["ISO3166-1-Alpha-2"],
                country_alpha_3_code: country.properties["ISO3166-1-Alpha-3"]
            };
        }
    }

    return null;
}

module.exports = find_country_by_lat_lng;