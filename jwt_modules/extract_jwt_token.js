function extract_jwt_token(req) {
  if (req.cookies && req.cookies.jwt_token) return req.cookies.jwt_token;

  if (req.headers && req.headers.authorization) {
    var authHeader = req.headers.authorization;
    if (authHeader.startsWith("Bearer ")) return authHeader.substring(7);
  }

  return null;
};

module.exports = extract_jwt_token;