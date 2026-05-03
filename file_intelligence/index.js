var express = require("express");
var app = express.Router();

var multer = require('multer');
var upload = multer({ storage: multer.memoryStorage() });

var crypto = require('crypto');

//Encryption Modules
var sha_256 = require("../encryption_modules/sha_256");
var aes_256_gcm_decrypt = require("../encryption_modules/aes_256_gcm_decrypt");

//middlewares
var rate_limiter = require("../middleware/rate_limiter");
var set_service_action_name = require("../middleware/set_service_action_name");
var create_session_id = require("../middleware/create_session_id");

//functions
var create_grid_fs = require("./create_grid_fs");
var read_grid_fs = require("./read_grid_fs");
var read_grid_fs_file_buffer = require("./read_grid_fs_file_buffer");
var add_file_intelligence_job = require("./add_file_intelligence_job");
var create_file_intelligence = require("./create_file_intelligence");
var format_date = require("../functions/format_date");

//şemalar
var fileintelligence = require("../schemas/file_intelligence_schema");
var country_reference = require("../schemas/country_reference_schema");

//JOI
var file_intelligence_service_schema = require("../joi_schemas/file_intelligence_service_schema");
var file_intelligence_detail_service_schema = require("../joi_schemas/file_intelligence_detail_service_schema");

//cache
var server_cache = require("../cache");
/*
  await server_cache.set(key, data, ttl_seconds);
  await server_cache.del(key);
  await server_cache.get(key);
*/

var { OPEN_AI_API_KEY } = process.env;
if( !OPEN_AI_API_KEY ) throw "OPEN_AI_API_KEY required. ";      

//Dosya yükleme servisi.
app.post(
    "/file-intelligence",
    rate_limiter,
    create_session_id,
    set_service_action_name({action: 'file-intelligence'}),
    upload.array("files", 1),
    async(req, res) => {

        var { default_locale_code } = req.body;

        var { error } = file_intelligence_service_schema.validate(req.body, { abortEarly: false });
        if( error) return res.status(400).json({errors: error.details.map(detail => detail.message), success: false });

        var files = req?.files || [];
        if( !files.length ) return res.status(404).end();

        try{

            var file_buffer = files[0].buffer; // önyüzden gelen buffer.
            var hashed_file_buffer = sha_256(file_buffer);

            var uploaded_files = await create_grid_fs(req, files);

            var node_cache_key = 'country_references';

            var country_references = await server_cache.get(node_cache_key);
            if( !country_references.length ) return res.status(404).json({ message:' country_references redis error. ', success: false });

            var country_reference_detail = country_references.find(function(item){ return item.default_locale_code === default_locale_code });
            if( !country_reference_detail ) return res.status(404).json({ message:' Invalid local code.', success: false });

            var country_reference_id = country_reference_detail._id.toString();

            for (var i = 0; i < uploaded_files.length; i += 1) {
                var stored_file = uploaded_files[i];

                var job = await add_file_intelligence_job({
                    file_id: String(stored_file.file_id),
                    original_name: stored_file.original_name,
                    mime_type: stored_file.mime_type,
                    size: stored_file.size,
                    session_id: req.session_id,
                    action_name: "file-intelligence",
                    created_date: new Date(),
                    country_reference_id: country_reference_id
                });

                await create_file_intelligence(req, stored_file, job.id, hashed_file_buffer, country_reference_id);
            };

            return res.status(200).json({ message:' The transaction has been queued.', success: true, session_id: req.session_id });
        }catch(err){
            console.error(err);
            return res.status(500).json({ message:' file-intelligence service error. ', success: false });
        }
    }
);

//Dosya analiz sonucu.
app.get(
    "/file-intelligence-detail/:session_id",
    rate_limiter,
    set_service_action_name({action: 'file-intelligence-detail'}),
    async(req, res) => {

        var { session_id } = req.params;

        var { error } = file_intelligence_detail_service_schema.validate(req.params, { abortEarly: false });
        if( error) return res.status(400).json({errors: error.details.map(detail => detail.message), success: false });

        try{

            var cache_key = 'file_intelligence_detail_' + session_id;

            var cached_data = await server_cache.get(cache_key);
            if( cached_data ) {

                res.set("X-Cache", "HIT");
                return res.status(200).json({ success: true, file_intelligence_detail: cached_data });
            }

            var file_intelligence_filter = {
                session_id: session_id
            };

            var file_intelligence_detail = await fileintelligence.findOne(file_intelligence_filter)
                .select("_id session_id file_id created_date job_id analysis_result")
                .lean();
            if( !file_intelligence_detail ) return res.status(404).json({ success: false });

            file_intelligence_detail.created_date = format_date(file_intelligence_detail.created_date);
            file_intelligence_detail.analysis_result = aes_256_gcm_decrypt(file_intelligence_detail.analysis_result);

            await server_cache.set(cache_key, file_intelligence_detail, 86400);

            res.set("X-Cache", "MISS");
            return res.status(200).json({ success: true, file_intelligence_detail: file_intelligence_detail });
        }catch(err){
            console.error(err);
            return res.status(500).json({ message:' file-intelligence-detail service error. ', success: false });
        }
    }
);

module.exports = app;