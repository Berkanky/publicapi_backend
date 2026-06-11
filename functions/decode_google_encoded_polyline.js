function decode_google_encoded_polyline(encoded_string) {

  if (!encoded_string) return [];

  var coordinates = [];
  var index = 0;
  var lat = 0;
  var lng = 0;
  var len = encoded_string.length;

  while (index < len) {
    var shift = 0;
    var result = 0;
    var byte_value;

    do {
      if (index >= len) break;
      byte_value = encoded_string.charCodeAt(index++) - 63;
      result |= (byte_value & 0x1f) << shift;
      shift += 5;
    } while (byte_value >= 0x20 && index < len);

    var dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      if (index >= len) break;
      byte_value = encoded_string.charCodeAt(index++) - 63;
      result |= (byte_value & 0x1f) << shift;
      shift += 5;
    } while (byte_value >= 0x20 && index < len);

    var dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dlng;

    coordinates.push({
      lat: lat / 1e5,
      lng: lng / 1e5,
    });
  }

  return coordinates;
}

module.exports = decode_google_encoded_polyline;