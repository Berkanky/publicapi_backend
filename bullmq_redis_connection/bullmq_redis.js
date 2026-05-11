var IORedis = require("ioredis");
var build_redis_conn = require("./build_redis_conn");

var redis_conn = build_redis_conn();

if (!redis_conn) {
    throw new Error("Redis connection is not configured.");
}

var bullmq_redis = new IORedis(redis_conn, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false
});

bullmq_redis.on("connect", function () {
    console.log("✅ bullmq_redis_connected");
});

bullmq_redis.on("ready", function () {
    console.log("🚀 bullmq_redis_ready");
});

bullmq_redis.on("error", function (err) {
    console.error("bullmq_redis_error:", err && err.message ? err.message : err);
});

bullmq_redis.on("end", function () {
    console.error("bullmq_redis_end: connection closed");
});

module.exports = bullmq_redis;