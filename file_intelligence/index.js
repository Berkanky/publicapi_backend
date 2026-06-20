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
var verify_jwt_token = require("../jwt_modules/verify_jwt_token");

//functions
var create_grid_fs = require("./create_grid_fs");
var create_file_intelligence = require("./create_file_intelligence");
var format_date = require("../functions/format_date");

//şemalar
var subscribers = require("../schemas/subscribers_schema");
var fileintelligence = require("../schemas/file_intelligence_schema");

//bullmq
var create_bullmq_joq_queue = require("../bullmq_redis_connection/create_bullmq_joq_queue");

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
    verify_jwt_token,
    set_service_action_name({action: 'file-intelligence'}),
    upload.array("files", 1),
    async(req, res) => {

        var { subscriber_id, session_id } = req;
        var { country_iso_code } = req.body;

        var { error } = file_intelligence_service_schema.validate(req.body, { abortEarly: false });
        if( error) return res.status(400).json({errors: error.details.map(detail => detail.message), success: false });

        var files = req?.files || [];
        if( !files.length ) return res.status(404).end();

        try{
            var file_buffer = files[0].buffer;
            var hashed_file_buffer = sha_256(file_buffer);

            var file_intelligence_filter = {
                buffer: hashed_file_buffer,
                subscriber_id: subscriber_id
            };
            var file_intelligence_detail = await fileintelligence.findOne(file_intelligence_filter).lean();
            if( file_intelligence_detail ) return res.status(409).json({ message:' Data already exists', success: false });

            var created_file_request__id = await create_file_intelligence(req, hashed_file_buffer);
            var uploaded_files = await create_grid_fs(req, files, created_file_request__id);

            for (var i = 0; i < uploaded_files.length; i += 1) {
                var stored_file = uploaded_files[i];

                var job_payload = {
                    file_id: String(stored_file.file_id),
                    original_name: stored_file.original_name,
                    mime_type: stored_file.mime_type,
                    size: stored_file.size,
                    subscriber_id: subscriber_id,
                    session_id: session_id,
                    action_name: "file-intelligence",
                    created_date: new Date(),
                    country_iso_code: country_iso_code,
                    created_file_request__id: created_file_request__id
                };

                var job_queue = await create_bullmq_joq_queue('file_intelligence_queue');
                var job = await job_queue.add(
                    "process_uploaded_file",
                    job_payload
                );

                var file_request_update = {
                    $set: {
                        job_id: job.id
                    }

                };
                await fileintelligence.findByIdAndUpdate(created_file_request__id, file_request_update);
            };

            return res.status(200).json({ message:' The transaction has been queued.', success: true, _id: created_file_request__id });
        }catch(err){
            console.error(err);
            return res.status(500).json({ message:' file-intelligence service error. ', success: false });
        }
    }
);

//Dosya analiz sonucu.
app.get(
    "/file-intelligence-detail/:_id",
    rate_limiter,
    verify_jwt_token,
    set_service_action_name({action: 'file-intelligence-detail'}),
    async(req, res) => {

        var { subscriber_id } = req;
        var { _id } = req.params;

        var { error } = file_intelligence_detail_service_schema.validate(req.params, { abortEarly: false });
        if( error) return res.status(400).json({errors: error.details.map(detail => detail.message), success: false });

        try{

            var cache_key = 'file_intelligence_detail:' + _id;

            var cached_data = await server_cache.get(cache_key);
            if( cached_data ) {
                if( cached_data.subscriber_id !== subscriber_id ) return res.status(404).json({ success: false });

                res.set("X-Cache", "HIT");
                return res.status(200).json({ success: true, detail: cached_data });
            }

            var file_intelligence_filter = {
                _id: _id,
                subscriber_id: subscriber_id
            };
            var file_intelligence_detail = await fileintelligence.findOne(file_intelligence_filter)
                .select("-_id subscriber_id session_id file_id created_date job_id analysis_result")
                .lean();
            
            if( !file_intelligence_detail ) return res.status(404).json({ success: false });

            file_intelligence_detail.created_date = format_date(file_intelligence_detail.created_date);
            file_intelligence_detail.analysis_result = aes_256_gcm_decrypt(file_intelligence_detail.analysis_result);

            await server_cache.set(cache_key, file_intelligence_detail, 86400);
            return res.status(200).json({ success: true, detail: file_intelligence_detail });
        }catch(err){
            console.error(err);
            return res.status(500).json({ message:' file-intelligence-detail service error. ', success: false });
        }
    }
);

module.exports = app;