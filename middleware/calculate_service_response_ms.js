function calculate_service_response_ms(req, res, next) {

  var start_time = process.hrtime.bigint();
  var original_write_head = res.writeHead;

  function get_duration_ms() {
    var end_time = process.hrtime.bigint();
    return Number(end_time - start_time) / 1e6;
  }

  res.writeHead = function () {
    var duration_ms = get_duration_ms();

    if (!res.headersSent) {
      res.setHeader("X-Response-Time", duration_ms.toFixed(2) + "ms");
    }

    return original_write_head.apply(this, arguments);
  };

  return next();
};

module.exports = calculate_service_response_ms;