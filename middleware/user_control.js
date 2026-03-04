var user = require("../schemas/user");

async function user_control(req, res, next){
  
  var user_detail = await user.findById(req.user_id).lean();
  if( !user_detail ) return res.status(404).json({ message:' user not found. ', success: false });

  req.user_detail = user_detail;
  return next();
};

module.exports = user_control;