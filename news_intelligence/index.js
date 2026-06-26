var express = require("express");
var app = express.Router();

var mongoose = require('mongoose');
var Queue = require("bullmq").Queue;

//bullmq redis connection
var bullmq_redis = require("../bullmq_redis_connection/bullmq_redis");
var create_bullmq_joq_queue = require("../bullmq_redis_connection/create_bullmq_joq_queue");

//middlewares
var rate_limiter = require("../middleware/rate_limiter");
var set_service_action_name = require("../middleware/set_service_action_name");

//şifreleme modülleri
var sha_256 = require('../encryption_modules/sha_256');

//şemalar
var news_request = require("../schemas/news_request_schema");
var subscribers = require("../schemas/subscribers_schema");

//JOI
var news_intelligence_service_schema = require("../joi_schemas/news_intelligence_service_schema");

//jwt modülleri
var verify_jwt_token = require("../jwt_modules/verify_jwt_token");

//Haber isteği servisi
app.post(
    '/news-intelligence',
    rate_limiter,
    verify_jwt_token,
    set_service_action_name({action: 'news-intelligence'}),
    async(req, res) => {
        
        var {
            start_date, 
            end_date, 
            country_iso_code, 
            category, 
            page_size,
            page,
            sort_by
        } = req.body;

        var { error } = news_intelligence_service_schema.validate(req.body, { abortEarly: false });
        if( error) return res.status(400).json({errors: error.details.map(detail => detail.message), success: false });

        try{   

            var { subscriber_id, session_id } = req;

            var job_payload = req.body;
            var request_hash = sha_256(JSON.stringify(req.body));

            var news_request_obj = {
                subscriber_id: subscriber_id,
                country_alpha_2_code: country_iso_code,
                category: category,
                created_date: new Date(),
                status: 'processed',
                page_size: page_size,
                page: page,
                sort_by: sort_by,
                request_hash: request_hash,
                session_id: session_id
            };

            if( start_date ) news_request_obj.start_date = new Date(String(start_date));
            if( end_date ) news_request_obj.end_date = new Date(String(end_date));

            var new_news_request = new news_request(news_request_obj);
            await new_news_request.save();

            var created_news_request__id = new_news_request._id.toString();

            Object.assign(job_payload, { 
                request_hash: request_hash,
                subscriber_id: subscriber_id,
                created_news_request__id: created_news_request__id,
                session_id: session_id
            });

            var job_queue = await create_bullmq_joq_queue("news_intelligence_queue");

            var job = await job_queue.add(
                "process_news_intelligence",
                job_payload
            );

            var news_request_update = {
                $set: {
                    job_id: job.id
                }
            };
            await news_request.findByIdAndUpdate(created_news_request__id, news_request_update);      
            return res.status(200).json({ message:' news-intelligence service successfully completed.', success: true, _id: created_news_request__id });
        }catch(err){
            console.error(err);
            return res.status(500).json({ message:' news-intelligence service error. ', success: false });
        }
    }
);

module.exports = app;