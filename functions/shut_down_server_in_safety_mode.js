const mongoose = require("mongoose");

function shut_down_server_in_safety_mode() {
  return mongoose.connection.close().then(() => process.exit(0)).catch(() => process.exit(1));
};

module.exports = shut_down_server_in_safety_mode;