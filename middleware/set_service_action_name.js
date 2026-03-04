function set_service_action_name(param) {
  return function(req, res, next) {

    req.action_name = param.action;
    return next();
  };
}
module.exports = set_service_action_name;