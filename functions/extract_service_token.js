function extract_service_token(req) {
  if (req.cookies && req.cookies.access_token) return req.cookies.access_token;

  var auth = req.headers.authorization;
  if (auth && /^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, "").trim();
  
  return null;
};

module.exports = extract_service_token;