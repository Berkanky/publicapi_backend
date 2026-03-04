function extract_service_refresh_token(req) {
  if (req.cookies && req.cookies.refresh_token) return req.cookies.refresh_token;
  return null;
};

module.exports = extract_service_refresh_token;