function convert_second_to_normalized_string(duration_seconds) {
  if (!duration_seconds) {
    return 'Estimated arrival N/A';
  }

  var hours = Math.floor(duration_seconds / 3600);
  var minutes = Math.round((duration_seconds % 3600) / 60);

  if (minutes === 60) {
    hours += 1;
    minutes = 0;
  }

  var parts = [];

  if (hours > 0) {
    parts.push(
      hours + ' ' + (hours === 1 ? 'Hour' : 'Hours')
    );
  }

  if (minutes > 0) {
    parts.push(
      minutes + ' ' + (minutes === 1 ? 'Minute' : 'Minutes')
    );
  }

  if (parts.length === 0) {
    parts.push('Less than 1 Minute');
  }

  return 'Estimated arrival ' + parts.join(' ');
};

module.exports = convert_second_to_normalized_string;