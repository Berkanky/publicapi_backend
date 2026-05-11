var Queue = require("bullmq").Queue;
var bullmq_redis = require("../bullmq_redis_connection/bullmq_redis");

var file_intelligence_queue = new Queue("file_intelligence_queue", {
    connection: bullmq_redis,
    defaultJobOptions: {
        attempts: 1,
        backoff: {
            type: "exponential",
            delay: 5000
        },
        removeOnComplete: 1000,
        removeOnFail: 5000
    }
});

module.exports = file_intelligence_queue;