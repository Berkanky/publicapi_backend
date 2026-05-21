var Queue = require("bullmq").Queue;

var bullmq_redis = require("./bullmq_redis");

async function create_bullmq_joq_queue(queue_name){
    var job_queue = new Queue(queue_name, {
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

    return job_queue;
};

module.exports = create_bullmq_joq_queue;