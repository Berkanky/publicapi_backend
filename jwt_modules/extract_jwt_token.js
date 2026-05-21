function extract_jwt_token(req) {
  if (req.cookies && req.cookies.jwt_token) return req.cookies.jwt_token;
  return null;
};

module.exports = extract_jwt_token;