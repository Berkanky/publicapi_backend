var ip_request_counts = new Map();

var LIMIT = 10;
var TIME_FRAME = 60000;

function cleanup() {
  var now = Date.now();

  for (var [ip, data] of ip_request_counts) {
    if (now - data.start_time > TIME_FRAME) {
      ip_request_counts.delete(ip);
    }
  }
}

setInterval(cleanup, 60000);

async function rate_limiter(req, res, next) {

  var ip = req.ip;
  var now = Date.now();

  var ip_data = ip_request_counts.get(ip);

  if (!ip_data) {

    ip_request_counts.set(ip, {
      count: 1,
      start_time: now
    });

    return next();
  }

  if (now - ip_data.start_time > TIME_FRAME) {

    ip_request_counts.set(ip, {
      count: 1,
      start_time: now
    });

    return next();
  }

  if (ip_data.count >= LIMIT) {
    return res.status(429).json({
      message: "Too many requests. Please try again later."
    });
  }

  ip_data.count += 1;
  ip_request_counts.set(ip, ip_data);

  return next();
}

module.exports = rate_limiter;