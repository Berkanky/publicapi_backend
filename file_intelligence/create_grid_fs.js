var { Readable } = require('stream');
var crypto = require('crypto');

async function create_grid_fs(req, files) {

    var app_locals = req.app.locals;

    var files_bucket = app_locals.files_bucket;
    if (!files_bucket) throw new Error('files_bucket required.');

    var uploaded_files = [];

    for (var i = 0; i < files.length; i++) {

        var file_row = files[i];

        var buffer_sha256 = crypto
            .createHash('sha256')
            .update(file_row.buffer)
            .digest('hex');

        var meta_data = {
            sha256: buffer_sha256,
            original_name: file_row.originalname,
            mime_type: file_row.mimetype,
            size: file_row.size,
            created_date: new Date(),
            session_id: req.session_id
        };

        var uploadStream = files_bucket.openUploadStream(file_row.originalname, {
            contentType: file_row.mimetype || 'application/octet-stream',
            metadata: meta_data
        });

        await new Promise((resolve, reject) => {
            Readable.from(file_row.buffer)
                .pipe(uploadStream)
                .on('finish', resolve)
                .on('error', reject);
        });

        uploaded_files.push({
            file_id: uploadStream.id,
            metadata: meta_data
        });
    }

    return uploaded_files;
};

module.exports = create_grid_fs;