function normalize_google_compute_routes_distance_details(route_data) {
  if (!route_data) {
    return {
      distance_km: '0.0',
      duration_string: 'Estimated arrival N/A'
    };
  }

  var distance_km = 0.0;

  if (
    route_data.distanceMeters &&
    !isNaN(Number(route_data.distanceMeters))
  ) {
    distance_km = Number(route_data.distanceMeters) / 1000;
  }

  var duration_string = 'Estimated arrival N/A';

  if (route_data.duration) {
    var duration_seconds = parseInt(
      String(route_data.duration).replace('s', ''),
      10
    );

    if (!isNaN(duration_seconds) && duration_seconds >= 0) {
      if (duration_seconds === 0) {
        duration_string = 'Estimated arrival 0 Minutes';
      } else {
        var hours = Math.floor(duration_seconds / 3600);
        var remaining_seconds = duration_seconds % 3600;
        var minutes = Math.round(remaining_seconds / 60);

        var parts = [];

        if (hours > 0) {
          parts.push(`${hours} ${hours === 1 ? 'Hour' : 'Hours'}`);
        }

        var display_minutes = minutes;
        var display_hours = hours;

        if (display_minutes === 60) {
          display_hours += 1;
          display_minutes = 0;

          parts = [
            `${display_hours} ${display_hours === 1 ? 'Hour' : 'Hours'}`
          ];
        } else if (display_minutes > 0) {
          parts.push(
            `${display_minutes} ${
              display_minutes === 1 ? 'Minute' : 'Minutes'
            }`
          );
        }

        if (parts.length === 0 && duration_seconds > 0) {
          parts.push('Less than 1 Minute');
        }

        duration_string = `Estimated arrival ${parts.join(' ')}`;
      }
    }
  }

  return {
    distance_km: Number(distance_km.toFixed(1)),
    duration_string: duration_string
  };
}

module.exports = normalize_google_compute_routes_distance_details;