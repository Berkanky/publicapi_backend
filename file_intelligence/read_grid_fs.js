async function read_grid_fs(req){

    var app_db = req.app.locals.db;
    var files = [];

    files = await app_db
        .collection("files.files")
        .find({ "metadata.session_id": req.session_id })
        .project({
            _id: 1,
            filename: 1,
            uploadDate: 1,
            contentType: 1
        })
        .toArray();

    return files;
};

module.exports = read_grid_fs;