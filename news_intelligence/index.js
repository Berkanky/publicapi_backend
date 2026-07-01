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
var country_reference = require("../schemas/country_reference_schema");

//JOI
var news_intelligence_service_schema = require("../joi_schemas/news_intelligence_service_schema");

//jwt modülleri
var verify_jwt_token = require("../jwt_modules/verify_jwt_token");

//fonksiyonlar
var format_date = require("../functions/format_date");

//cache
var server_cache = require("../cache");

var { NODE_ENV } = process.env;
if( !NODE_ENV ) throw "NODE_ENV required. ";

//Middlewares
async function daily_limit(req, res, next){

    var { subscriber_id } = req;

    var start_of_day = new Date();
    start_of_day.setHours(0, 0, 0, 0);

    var end_of_day = new Date();
    end_of_day.setHours(23, 59, 59, 999);

    var news_request_filter = { 
        subscriber_id: subscriber_id, 
        created_date: { $gte: start_of_day, $lte: end_of_day },
        status: 'successful',
        notification_status: 'successful'
    };
    var news_requests = await news_request.find(news_request_filter).lean();
    if( news_requests.length >= 5 ) {
        res.status(429).json({ success: false, message:' The daily limit has been reached.' });
        return false;
    }

    return true;
};

async function schedule_limit(req, res, next){

    var { subscriber_id } = req;

    var news_request_filter = { 
        subscriber_id: subscriber_id, 
        status: 'successful',
        notification_status: 'successful',
        is_scheduled: true
    };

    var news_requests = await news_request.find(news_request_filter).lean();
    if( !news_requests.length ) return true;

    var scheduled_news_requset_count = news_requests.length;
    if( scheduled_news_requset_count >= 5 ) {
        
        res.status(429).json({ success: false, message: 'You have reached your limit for scheduled news subscriptions.' });
        return false;
    }

    return true;
};

//functions
function dynamic_page_size(frequency){

    var page_size;
    
    if( frequency === 'daily' ) page_size = 10;
    else if( frequency === 'weekly' ) page_size = 30;
    else if( frequency === 'monthly') page_size = 50;
    else page_size = 10;

    return page_size;
};

function get_next_run_date(frequency, date) {

    var now = new Date(String(date));
    var next_run_date;

    var minute = now.getMinutes();
    var hour = now.getHours();

    switch (frequency) {
        case "daily":
        next_run_date = new Date(now);
        next_run_date.setDate(now.getDate() + 1);
        break;

        case "weekly":
        next_run_date = new Date(now);
        next_run_date.setDate(now.getDate() + 7);
        break;

        case "monthly":
        next_run_date = new Date(now);
        next_run_date.setMonth(now.getMonth() + 1);
        break;
    }

    return {
        next_run_date: next_run_date
    };
};

var key = 'news_requests:';

//Abonelikleri getir servisi
app.get(
    '/news-intelligence-detail',
    verify_jwt_token,
    set_service_action_name({action: 'news-intelligence-detail'}),
    async(req, res) => {
        try{
            var requests;
            var { subscriber_id } = req;
            key = key + subscriber_id; 

            requests = await server_cache.get(key);
            if( requests ){

                res.set("X-Cache", "HIT");
                return res.status(200).json({ success: true, news_requests: requests });
            } else requests = [];

            var news_requests_filter = {
                subscriber_id: subscriber_id
            };

            var news_requests = await news_request.find(news_requests_filter).lean();
            if( !news_requests.length ) return res.status(404).json({ success: false });
            
            for(var i = 0; i < news_requests.length; i++){

                var row = news_requests[i];
                var {
                    session_id,
                    start_date,
                    end_date,
                    country_alpha_2_code,
                    category,
                    created_date,
                    status,
                    page_size,
                    sort_by,
                    page,
                    frequency,
                    is_scheduled,
                    job_id,
                    next_run_date,
                    notification_status,
                    updated_date
                } = row;

                if( updated_date ) row.updated_date = format_date(updated_date);
                if( start_date ) row.start_date = format_date(start_date);
                if( end_date ) row.end_date = format_date(end_date);
                if( next_run_date ) row.next_run_date = format_date(next_run_date);

                row.created_date = format_date(created_date);
                
                var country_reference_filter = {
                    country_alpha_2_code: country_alpha_2_code,
                    is_active: true
                };
                var country_reference_detail = await country_reference.findOne(country_reference_filter)
                    .select("country_alpha_2_code official_languages")
                    .lean();

                var language_details = {};

                if( country_reference_detail ) {

                    var { official_languages } = country_reference_detail;
                    if( official_languages && official_languages.length ) language_details = official_languages[0];
                }
                if( Object.keys(language_details).length ) {
                    var { language_name, language_alpha_2_code } = language_details;
                    Object.assign(row, {
                        language_details: { language_name, language_alpha_2_code }
                    });
                }
                
                requests.push(row);

                delete row.subscriber_id;
                continue;
            };

            await server_cache.set(key, requests, 86400);

            return res.status(200).json({ success: true, news_requests: requests });
        }catch(err){
            console.error(err);
            return res.status(500).json({ success: false, message: ' news-intelligence-detail' });
        }
    }
);

//Haber isteği servisi
app.post(
    '/news-intelligence',
    verify_jwt_token,
    set_service_action_name({action: 'news-intelligence'}),
    async(req, res, next) => {
        
        var {
            start_date, 
            end_date, 
            country_iso_code, 
            category,
            frequency
        } = req.body;

        var { error } = news_intelligence_service_schema.validate(req.body, { abortEarly: false });
        if( error) return res.status(400).json({errors: error.details.map(detail => detail.message), success: false });

        try{   

            var { subscriber_id, session_id, email_address } = req;
            key = key + subscriber_id;

            var job_payload = req.body;
            var request_hash = sha_256(JSON.stringify({start_date, end_date, country_iso_code, category }));

            var news_request_filter = {
                request_hash: request_hash,
                subscriber_id: subscriber_id,
                status: 'successful',
                notification_status: 'successful',
            };

            var existing_news_request = await news_request.findOne(news_request_filter).lean();
            if( existing_news_request ) {

                var _id = existing_news_request._id;
                var updated_date = new Date();
                var updated_next_run_date;
                if( frequency ) updated_next_run_date = get_next_run_date(frequency, updated_date).next_run_date;

                var news_request_update = {
                    $set: {
                        frequency: frequency || null,
                        updated_date: updated_date,
                        page_size: dynamic_page_size(frequency),
                        next_run_date: frequency ? updated_next_run_date : null,
                        is_scheduled: frequency ? true : false,
                    }
                };

                await news_request.findByIdAndUpdate(_id, news_request_update);

                await server_cache.del(key);
                return res.status(204).json({ 
                    success: true,
                    _id: _id
                });
            }

            var daily_limit_result = await daily_limit(req, res, next);
            if( !daily_limit_result ) return;

            var schedule_limit_result = await schedule_limit(req, res, next);
            if( !schedule_limit_result ) return;

            var created_date = new Date();
            var page_size = dynamic_page_size(frequency);

            var news_request_obj = {
                subscriber_id: subscriber_id,
                country_alpha_2_code: country_iso_code,
                category: category,
                created_date: created_date,
                status: 'processed',
                page_size: page_size,
                page: 1,
                sort_by: 'publishedAt',
                request_hash: request_hash,
                session_id: session_id,
                frequency: frequency || null,
                is_scheduled: frequency ? true : false
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
                session_id: session_id,
                email_address: email_address,
                created_date: created_date,
                is_existing: false
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

            await server_cache.del(key);
            return res.status(200).json({ message:' news-intelligence service successfully completed.', success: true, _id: created_news_request__id });
        }catch(err){
            console.error(err);
            return res.status(500).json({ message:' news-intelligence service error. ', success: false });
        }
    }
);

module.exports = app;