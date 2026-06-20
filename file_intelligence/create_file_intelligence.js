var fileintelligence = require("../schemas/file_intelligence_schema");

async function create_file_intelligence(req, hashed_file_buffer){
    var { subscriber_id, session_id } = req;
    var { country_iso_code } = req.body;

    var new_file_obj = {
        subscriber_id: subscriber_id,
        session_id: session_id,
        created_date: new Date(),
        status: "processed",
        buffer: hashed_file_buffer,
        country_alpha_2_code: country_iso_code
    };

    var new_file = new fileintelligence(new_file_obj);
    await new_file.save();

    var created_file_request__id = new_file._id.toString();
    return created_file_request__id;
};  

module.exports = create_file_intelligence;