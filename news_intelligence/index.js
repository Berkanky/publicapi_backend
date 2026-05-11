var express = require("express");
var app = express.Router();

var axios = require('axios');
var crypto = require('crypto');

var Queue = require("bullmq").Queue;

//bullmq redis connection
var bullmq_redis = require("../bullmq_redis_connection/bullmq_redis");

//Encryption Modules
var sha_256 = require("../encryption_modules/sha_256");
var aes_256_gcm_decrypt = require("../encryption_modules/aes_256_gcm_decrypt");

//middlewares
var rate_limiter = require("../middleware/rate_limiter");
var set_service_action_name = require("../middleware/set_service_action_name");
var create_session_id = require("../middleware/create_session_id");
var email_address_verification = require("../middleware/email_address_verification");

//functions
var format_date = require("../functions/format_date");

//şifreleme modülleri
var sha_256 = require('../encryption_modules/sha_256');

//şemalar
var news_request = require("../schemas/news_request_schema");
var articles = require("../schemas/articles_schema");

//JOI
var news_intelligence_service_schema = require("../joi_schemas/news_intelligence_service_schema");

//cache
var server_cache = require("../cache");
/*
  await server_cache.set(key, data, ttl_seconds);
  await server_cache.del(key);
  await server_cache.get(key);
*/

var { OPEN_AI_API_KEY, NEWS_API_KEY, NODE_ENV, BASE_URL } = process.env;

if( !OPEN_AI_API_KEY ) throw "OPEN_AI_API_KEY required. ";  
if( !NEWS_API_KEY ) throw "NEWS_API_KEY required. ";    
if( !NODE_ENV ) throw "NODE_ENV required. ";
if( !BASE_URL ) throw "BASE_URL required. ";

app.post(
    '/news-intelligence',
    rate_limiter,
    email_address_verification,
    create_session_id,
    set_service_action_name({action: 'news-intelligence'}),
    async(req, res) => {
        
        var { 
            email_address, 
            start_date, 
            end_date, 
            default_locale_code, 
            category, 
            page_size,
            page,
            sort_by
        } = req.body;

        var { error } = news_intelligence_service_schema.validate(req.body, { abortEarly: false });
        if( error) return res.status(400).json({errors: error.details.map(detail => detail.message), success: false });

        var session_id = req.session_id;

        try{   

            var news_intelligence_queue = new Queue("news_intelligence_queue", {
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

            var job_payload = req.body;
            var request_hash = sha_256(JSON.stringify(req.body));
            Object.assign(job_payload, { session_id: session_id, request_hash: request_hash });
            
            var job = await news_intelligence_queue.add(
                "process_news_intelligence",
                job_payload
            );

            var job_id = job.id;

            var news_request_obj = {
                email_address: email_address,
                session_id: session_id,
                default_locale_code: default_locale_code,
                category: category,
                created_date: new Date(),
                job_id: job_id,
                status: 'processed',
                page_size: page_size,
                page: page,
                sort_by: sort_by,
                request_hash: request_hash
            };

            if( start_date ) news_request_obj.start_date = new Date(String(start_date));
            if( end_date ) news_request_obj.end_date = new Date(String(end_date));

            var new_news_request = new news_request(news_request_obj);
            await new_news_request.save();

            return res.status(200).json({ message:' news-intelligence service successfully completed.', success: true, session_id: session_id });
        }catch(err){
            console.error(err);
            return res.status(500).json({ message:' news-intelligence service error. ', success: false });
        }
    }
);

module.exports = app;