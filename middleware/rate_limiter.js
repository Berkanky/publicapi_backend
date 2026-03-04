var ipRequestCounts = new Map();

async function rate_limiter(req, res, next) {
  
  var LIMIT = 150;
  var TIME_FRAME = 60000;

  var ip = req.ip;
  var currentTime = Date.now();

  if (!ipRequestCounts.has(ip)) {

    ipRequestCounts.set(ip, { count: 1, lastRequest: currentTime });
    return next();
  }

  var ipData = ipRequestCounts.get(ip);

  if (currentTime - ipData.lastRequest > TIME_FRAME) {
    
    ipRequestCounts.set(ip, { count: 1, lastRequest: currentTime });
    return next();
  }

  if (ipData.count >= LIMIT) return res.status(429).json({ message: " Too many requests! Please try again later." });

  ipData.count += 1;
  ipData.lastRequest = currentTime;
  ipRequestCounts.set(ip, ipData);
  
  return next();
};

module.exports = rate_limiter;