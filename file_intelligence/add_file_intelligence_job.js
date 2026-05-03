var file_intelligence_queue = require("./file_intelligence_queue");

async function add_file_intelligence_job(job_payload) {
    var job = await file_intelligence_queue.add(
        "process_uploaded_file",
        job_payload
    );

    return job;
}

module.exports = add_file_intelligence_job;