var mongoose = require("mongoose");

async function read_grid_fs_file_buffer(file_id) {
    var app_db = mongoose.connection.db;

    if (!app_db) {
        throw new Error("mongoose connection db is not ready");
    }

    var files_bucket = new mongoose.mongo.GridFSBucket(app_db, {
        bucketName: "files"
    });

    return await new Promise(function (resolve, reject) {
        var chunks = [];
        var object_id = new mongoose.Types.ObjectId(String(file_id));
        var download_stream = files_bucket.openDownloadStream(object_id);

        download_stream.on("data", function (chunk) {
            chunks.push(chunk);
        });

        download_stream.on("error", function (err) {
            reject(err);
        });

        download_stream.on("end", function () {
            resolve(Buffer.concat(chunks));
        });
    });
};

module.exports = read_grid_fs_file_buffer;