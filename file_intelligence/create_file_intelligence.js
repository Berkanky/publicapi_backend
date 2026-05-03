var fileintelligence = require("../schemas/file_intelligence_schema");

async function create_file_intelligence(req, file, job_id, hashed_file_buffer, country_reference_id){

    var new_file_obj = {
        session_id: req.session_id,
        file_id: file.file_id,
        job_id: job_id,
        created_date: new Date(),
        status: 0,
        buffer: hashed_file_buffer,
        country_reference_id: country_reference_id
    };

    var new_file = new fileintelligence(new_file_obj);
    await new_file.save();

    return true;
};  

module.exports = create_file_intelligence;