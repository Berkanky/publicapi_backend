function build_redis_conn() {
    var redis_url = process.env.REDIS_URL;

    if (redis_url && redis_url.length > 0) return redis_url + (redis_url.indexOf("?") !== -1 ? "&" : "?") + "family=0";
    else throw "Build Redis Connection failed. ";
};

module.exports = build_redis_conn;