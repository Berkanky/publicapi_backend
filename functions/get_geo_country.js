function get_geo_country(req) {

  var c = req.headers["cf-ipcountry"];
  if (c && /^[A-Z]{2}$/.test(c)) return c;
  return null;
};

module.exports = get_geo_country;