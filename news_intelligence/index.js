var express = require("express");
var app = express.Router();

var axios = require('axios');
var crypto = require('crypto');
var mongoose = require('mongoose');
var Queue = require("bullmq").Queue;

//bullmq redis connection
var bullmq_redis = require("../bullmq_redis_connection/bullmq_redis");
var create_bullmq_joq_queue = require("../bullmq_redis_connection/create_bullmq_joq_queue");

//Encryption Modules
var aes_256_gcm_decrypt = require("../encryption_modules/aes_256_gcm_decrypt");

//middlewares
var rate_limiter = require("../middleware/rate_limiter");
var set_service_action_name = require("../middleware/set_service_action_name");
var create_session_id = require("../middleware/create_session_id");
var email_address_verification = require("../middleware/email_address_verification");

//functions
var format_date = require("../functions/format_date");
var calculate_expire_date = require("../functions/calculate_expire_date");
var random_verification_code = require("../functions/random_verification_code");
var create_refresh_session = require("../insert_operations/create_refresh_session");

//şifreleme modülleri
var sha_256 = require('../encryption_modules/sha_256');

//şemalar
var news_request = require("../schemas/news_request_schema");
var articles = require("../schemas/articles_schema");
var subscribers = require("../schemas/subscribers_schema");
var refresh_session = require("../schemas/refresh_session_schema");

//JOI
var news_intelligence_service_schema = require("../joi_schemas/news_intelligence_service_schema");
var email_address_verification_schema = require("../joi_schemas/email_address_verification_schema");
var start_subscribe_cancel_schema = require("../joi_schemas/start_subscribe_cancel_schema");
var google_login_service_schema = require("../joi_schemas/google_login_service_schema");
var send_email_address_verification_schema = require("../joi_schemas/send_email_address_verification_schema");

//jwt modülleri
var create_jwt_token = require("../jwt_modules/create_jwt_token");
var verify_jwt_token = require("../jwt_modules/verify_jwt_token");

//cookie modülleri
var set_res_cookie = require("../cookie_operations/set_res_cookie");
var clear_res_cookie = require("../cookie_operations/clear_res_cookie");
var clear_cookie_all_paths = require("../cookie_operations/clear_cookie_all_paths");
var set_cookie_all_paths = require("../cookie_operations/set_cookie_all_paths");

//Refresh token modülleri
var { create_refresh_token, hash_refresh_token } = require("../refresh_token_modules/create_refresh_token");
var extract_refresh_token = require("../refresh_token_modules/extract_refresh_token");

//google auth modülleri
var verify_google_id_token = require("../google_auth/verify_google_id_token");

//cache
var server_cache = require("../cache");
/*
  await server_cache.set(key, data, ttl_seconds);
  await server_cache.del(key);
  await server_cache.get(key);
*/

var { 
    OPEN_AI_API_KEY, 
    NEWS_API_KEY, 
    NODE_ENV, 
    BASE_URL 
} = process.env;

if( !OPEN_AI_API_KEY ) throw "OPEN_AI_API_KEY required. ";  
if( !NEWS_API_KEY ) throw "NEWS_API_KEY required. ";    
if( !NODE_ENV ) throw "NODE_ENV required. ";
if( !BASE_URL ) throw "BASE_URL required. ";

var jwt_token_cookie_expire_date_ms = NODE_ENV == 'production' ? 15 * 60 * 1000 : 5 * 60 * 1000;
var jwt_token_expire_date_st = NODE_ENV == 'production' ? '15m' : '1m';

async function find_existing_subscriber(req, res, filter, columns){

    var existing_subscribe = await subscribers.findOne(filter).lean();
    if( !existing_subscribe ) return res.status(404).json({ message:' User not found.', success: false });

    return existing_subscribe;
};

//abonelik iptali başlat
app.post(
    '/start-subscribe-cancel',
    rate_limiter,
    email_address_verification,
    create_session_id,
    set_service_action_name({action:'start-subscribe-cancel'}),
    async(req, res) => {

        var { email_address } = req.body;
        
        var { error } = start_subscribe_cancel_schema.validate(req.body, { abortEarly: false });
        if( error) return res.status(400).json({errors: error.details.map(detail => detail.message), success: false });
        
        try{

            var job_payload = req.body;

            var subscribe_filter = { email_address: email_address, verified: true };
            var existing_subscribe = await find_existing_subscriber(req, res, subscribe_filter, []);
            var { _id } = existing_subscribe;

            var subscription_cancellation_verification_code = random_verification_code();
            var subscription_cancellation_verification_code_hashed = sha_256(String(subscription_cancellation_verification_code));
            var subscription_cancellation_verification_code_expire_date = calculate_expire_date({ hours: 0, minutes: 15 });

            var subscribe_update = {
                $set: {
                    session_id: req.session_id,
                    subscription_cancellation_verification_code: subscription_cancellation_verification_code_hashed,
                    subscription_cancellation_verification_code_expire_date: subscription_cancellation_verification_code_expire_date
                }
            };

            await subscribers.findByIdAndUpdate(_id, subscribe_update);

            var job_queue = await create_bullmq_joq_queue('news_intelligence_email_address_verification_queue');

            job_payload.session_id = req.session_id;
            job_payload.verification_code = subscription_cancellation_verification_code;

            var job = await job_queue.add(
                "start-subscribe-cancel",
                job_payload
            );

            var { token } = await create_jwt_token(req, res, jwt_token_expire_date_st, req.session_id, email_address, _id);
            set_res_cookie(req, res, "jwt_token", token, jwt_token_cookie_expire_date_ms, '/subscribe-cancel');

            res.set('Cache-Control','no-store');
            return res.status(200).json({ message:' the subscription cancellation process has been initiated', success: true });
        }catch(err){
            console.error(err);
            return res.status(500).json({ message:' subscribe-cancel', success: false });
        }
    }
);

//abone iptal tamamla
app.post(
    '/subscribe-cancel',
    rate_limiter,
    verify_jwt_token,
    set_service_action_name({action: 'subscribe-cancel'}),
    async(req, res) => {

        var { email_address, verification_code } = req.body;

        var { error } = email_address_verification_schema.validate(req.body, { abortEarly: false });
        if( error) return res.status(400).json({errors: error.details.map(detail => detail.message), success: false });

        try{

            var subscribe_filter = { email_address: email_address };

            var existing_subscribe = await find_existing_subscriber(req, res, subscribe_filter, []);
            var { _id } = existing_subscribe;
            if( existing_subscribe.verified === false ) return res.status(200).json({ message:' Subscription is already canceled.', success: false });

            var subscription_cancellation_verification_code_hashed = sha_256(String(verification_code));

            if( new Date(String(existing_subscribe.subscription_cancellation_verification_code_expire_date)) < new Date() ) return res.status(400).json({ message: ' verification code expired. ', success: false });
            if( existing_subscribe.subscription_cancellation_verification_code !== subscription_cancellation_verification_code_hashed ) return res.status(400).json({ message:' verification code invalid. ', success: false });

            var subscribe_update = {
                $set: {
                    verified: false,
                    status: 'Your subscription has been successfully canceled.'
                },
                $unset:{
                    verification_code: null,
                    verification_code_expire_date: null,
                    subscription_cancellation_verification_code_expire_date: null,
                    subscription_cancellation_verification_code: null
                }
            };

            await subscribers.findByIdAndUpdate(_id, subscribe_update);

            clear_res_cookie(req, res, "jwt_token", '/subscribe-cancel');
            return res.status(200).json({ message: ' Your subscription has been successfully canceled.', success: true });
        }catch(err){
            console.error(err);
            return res.status(500).json({ message:' email-address-verification', success: false });
        }
    }
);

//Abonelik kaydı başlat
app.post(
    '/send-email-address-verification',
    rate_limiter,
    email_address_verification,
    create_session_id,
    set_service_action_name({action: 'verify-email-address'}),
    async(req, res) => {

        var { 
            email_address
        } = req.body;

        var { error } = send_email_address_verification_schema.validate(req.body, { abortEarly: false });
        if( error) return res.status(400).json({errors: error.details.map(detail => detail.message), success: false });

        try{

            var subscriber_id;
            var job_payload = req.body;
            var session_id = req.session_id;

            var subscribe_filter = { email_address: email_address };
            var existing_subscribe = await subscribers.findOne(subscribe_filter).select("_id verified").lean();
            
            var verification_code_expire_date = calculate_expire_date({ hours:0, minutes: 5 });
            var verification_code = random_verification_code();
            var verification_code_hashed = sha_256(String(verification_code));

            if( existing_subscribe ) {
                if( existing_subscribe.verified === true ) return res.status(409).json({ message: ' Already subscribed.', success: false });
                else{

                    var { _id } = existing_subscribe;

                    var subscribe_update = {
                        $set:{
                            session_id: session_id,
                            verification_code: verification_code_hashed,
                            verification_code_expire_date: verification_code_expire_date
                        }
                    };

                    await subscribers.findByIdAndUpdate(_id, subscribe_update );

                    subscriber_id = _id;
                }
            }else{

                var new_subscribe_obj = {
                    email_address: email_address,
                    verified: false,
                    status: 'email verification has been initiated',
                    verification_code: verification_code_hashed,
                    verification_code_expire_date: verification_code_expire_date,
                    session_id: session_id
                };

                var new_subscribe = new subscribers(new_subscribe_obj);
                await new_subscribe.save();

                subscriber_id = new_subscribe._id.toString();
            }

            console.log("Verification Code -> " + verification_code);

            var job_queue = await create_bullmq_joq_queue('news_intelligence_email_address_verification_queue');

            job_payload.session_id = session_id;
            job_payload.verification_code = verification_code;

            var job = await job_queue.add(
                "send-email-address-verification",
                job_payload
            );

            await subscribers.findOneAndUpdate({ email_address: email_address }, { job_id: job.id });

            var message = 'Email verification has been initiated. Please check your email and complete the verification process.';
            
            var { token } = await create_jwt_token(req, res, jwt_token_expire_date_st, req.session_id, email_address, subscriber_id);
            set_res_cookie(req, res, "jwt_token", token, jwt_token_cookie_expire_date_ms, '/email-address-verification');

            res.set('Cache-Control','no-store');
            return res.status(200).json({ messgae: message, success: true });
        }catch(err){
            console.error(err);
            return res.status(500).json({ message:' verify-email-address', success: false });
        }
    }
);

//Abone ol tamamla
app.post(
    '/email-address-verification',
    rate_limiter,
    verify_jwt_token,
    set_service_action_name({action: 'email-address-verification'}),
    async(req, res) => {

        var { email_address, verification_code } = req.body;

        var { error } = email_address_verification_schema.validate(req.body, { abortEarly: false });
        if( error) return res.status(400).json({errors: error.details.map(detail => detail.message), success: false });

        try{    

            var verification_code_hashed = sha_256(String(verification_code));

            var subscribe_filter = { 
                email_address: email_address
            };

            var existing_subscribe = await find_existing_subscriber(req, res, subscribe_filter, []);
            var { _id } = existing_subscribe;

            if( existing_subscribe.verification_code !== verification_code_hashed ) return res.status(400).json({ message:' verification code invalid. ', success: false });
            if( new Date(String(existing_subscribe.verification_code_expire_date)) < new Date() ) return res.status(400).json({ message:' verification code is expired', success: false });

            var subscribe_update = {
                $set: {
                    active: true,
                    verified: true,
                    subscription_date: new Date(),
                    status: 'the subscription process has been successfully completed',
                    login_date: new Date(),
                    login_type: 'Subscription registration and email verification'
                },
                $unset: {
                    subscription_cancellation_verification_code: null,
                    subscription_cancellation_verification_code_expire_date: null,
                    verification_code: null,
                    verification_code_expire_date: null
                }
            };

            await subscribers.findByIdAndUpdate(_id, subscribe_update);

            clear_res_cookie(req, res, "jwt_token", '/email-address-verification');

            var { token } = await create_jwt_token(req, res, jwt_token_expire_date_st, req.session_id, email_address, _id);            
            var { created_refresh_token, hashed_refresh_token } = await create_refresh_session(_id, req.session_id);

            set_cookie_all_paths(req, res, 'jwt_token', token, jwt_token_cookie_expire_date_ms);
            set_res_cookie(req, res, "refresh_token", created_refresh_token, 30 * 24 * 60 * 60 * 1000, '/refresh');

            res.set('Cache-Control','no-store');
            return res.status(200).json({ message:' Your subscription has been successfully processed.', success: true });
        }catch(err){
            console.error(err);
            return res.status(500).json({ message:' email-address-verification', success: false });
        }
    }
);

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
            default_locale_code, 
            category, 
            page_size,
            page,
            sort_by,
            daily_post
        } = req.body;

        var { error } = news_intelligence_service_schema.validate(req.body, { abortEarly: false });
        if( error) return res.status(400).json({errors: error.details.map(detail => detail.message), success: false });

        try{   

            var { email_address } = req;

            var job_payload = req.body;
            var request_hash = sha_256(JSON.stringify(req.body));

            var subscribe_filter = { email_address: email_address, verified: true };
            var existing_subscribe = await find_existing_subscriber(req, res, subscribe_filter, []);
            var { _id } = existing_subscribe;

            var subscribe_update = {
                $set: {
                    category: category,
                    default_locale_code: default_locale_code,
                    daily_post: daily_post
                }
            };

            await subscribers.findByIdAndUpdate(_id, subscribe_update);

            var news_request_obj = {
                subscriber_id: _id,
                default_locale_code: default_locale_code,
                category: category,
                created_date: new Date(),
                status: 'processed',
                page_size: page_size,
                page: page,
                sort_by: sort_by,
                request_hash: request_hash,
                session_id: req.session_id
            };

            if( start_date ) news_request_obj.start_date = new Date(String(start_date));
            if( end_date ) news_request_obj.end_date = new Date(String(end_date));

            var new_news_request = new news_request(news_request_obj);
            await new_news_request.save();

            var created_news_request__id = new_news_request._id.toString();

            Object.assign(job_payload, { 
                email_address: email_address,
                request_hash: request_hash,
                subscriber_id: _id,
                created_news_request__id: created_news_request__id,
                session_id: req.session_id
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

            return res.status(200).json({ message:' news-intelligence service successfully completed.', success: true, session_id: req.session_id });
        }catch(err){
            console.error(err);
            return res.status(500).json({ message:' news-intelligence service error. ', success: false });
        }
    }
);

//Zaten abone ise giriş yap servisi.
app.post(
    "/login",
    rate_limiter,
    create_session_id,
    set_service_action_name({ action: "login" }),
    async(req, res) => {
        setTimeout(function () {
            return res.json({ ok: true });
        }, 70000);

        var { email_address } = req.body;

        var { error } = start_subscribe_cancel_schema.validate(req.body, { abortEarly: false });
        if( error) return res.status(400).json({errors: error.details.map(detail => detail.message), success: false });

        try{

            var job_payload = req.body;

            var subscribe_filter = { email_address: email_address };

            var existing_subscribe = await find_existing_subscriber(req, res, subscribe_filter, []);
            var { _id } = existing_subscribe;

            if( !existing_subscribe.verified ) return res.status(200).json({ message:' Your account subscription is not active.', success: false });

            var verification_code = random_verification_code();
            var verification_code_hashed = sha_256(String(verification_code));

            job_payload.session_id = req.session_id;
            job_payload.verification_code = verification_code;

            var subscribe_update = {
                $set: {
                    active: false,
                    session_id: req.session_id,
                    verification_code: verification_code_hashed,
                    verification_code_expire_date: calculate_expire_date({hours: 0, minutes: 15 })
                }
            };

            await subscribers.findByIdAndUpdate(_id, subscribe_update);

            var job_queue = await create_bullmq_joq_queue('news_intelligence_email_address_verification_queue');

            var job = await job_queue.add(
                "login",
                job_payload
            );

            var { token } = await create_jwt_token(req, res, jwt_token_expire_date_st, req.session_id, email_address, _id);
            set_res_cookie(req, res, "jwt_token", token, jwt_token_cookie_expire_date_ms, '/login-verify');

            res.set('Cache-Control','no-store');
            return res.status(200).json({ message:' The verification code has been successfully sent; please check your email. ', success: true });
        }catch(err){
            console.error(err);
            return res.status(500).json({ message:' login service error. ', success: false });
        }
    } 
);

//Abone giriş onayla
app.post(
    "/login-verify",
    rate_limiter,
    verify_jwt_token,
    set_service_action_name({ action: 'login-verify'}),
    async(req, res) => {

        var { email_address, verification_code } = req.body

        var { error } = email_address_verification_schema.validate(req.body, { abortEarly: false });
        if( error) return res.status(400).json({errors: error.details.map(detail => detail.message), success: false });

        try{

            var verification_code_hashed = sha_256(verification_code);

            var subscribe_filter = { email_address: email_address };
            var existing_subscribe = await find_existing_subscriber(req, res, subscribe_filter, []);
            var { _id } = existing_subscribe;

            if( !existing_subscribe.verified ) return res.status(403).json({ message:' Your account subscription is not active.', success: false });
            if( new Date(String(existing_subscribe.verification_code_expire_date)) < new Date() ) return res.status(400).json({ message: ' verification code expired. ', success: false });
            if( existing_subscribe.verification_code !== verification_code_hashed ) return res.status(400).json({ message:' verification code invalid. ', success: false });

            var subscribe_update = {
                $set: {
                    active: true,
                    login_date: new Date(),
                    status: 'User login was successful'
                },
                $unset:{
                    verification_code: null,
                    verification_code_expire_date: null
                }
            };
            await subscribers.findByIdAndUpdate(_id, subscribe_update);

            var { token } = await create_jwt_token(req, res, jwt_token_expire_date_st, req.session_id, email_address, _id);            
            var { created_refresh_token, hashed_refresh_token } = await create_refresh_session(_id, req.session_id);

            clear_res_cookie(req, res, "jwt_token", '/login-verify');

            //set_res_cookie(req, res, "jwt_token", token, jwt_token_cookie_expire_date_ms, '/');
            set_cookie_all_paths(req, res, 'jwt_token', token, jwt_token_cookie_expire_date_ms);
            set_res_cookie(req, res, "refresh_token", created_refresh_token, 30 * 24 * 60 * 60 * 1000, '/refresh');

            res.set('Cache-Control','no-store');
            return res.status(200).json({ message:' You have successfully logged in. Welcome.', success: true });
        }catch(err){
            console.error(err);
            return res.status(500).json({ message:' login-verify service error. ', success: false });
        }
    }
);

//Google ile giriş servisi. ( email yoksa kayıt )
app.post(
    "/google-login",
    rate_limiter,
    create_session_id,
    set_service_action_name({ action: 'google-login' }),
    async(req, res) => {

        var { id_token } = req.body;
        
        var { error } = google_login_service_schema.validate(req.body, { abortEarly: false });
        if( error) return res.status(400).json({errors: error.details.map(detail => detail.message), success: false });

        try{    

            var existing_subscribe__id;

            var {
                email_verified,
                google_id,
                email_address,
                name,
                surname,
                full_name,
                profile_picture,
                iat,
                exp
            } = await verify_google_id_token(id_token);

            var subscribe_filter = { email_address: email_address };
            var existing_subscribe = await subscribers.findOne(subscribe_filter).lean();
            
            if( !existing_subscribe ){

                var new_subscribe_obj = {
                    session_id: req.session_id,
                    email_address: email_address,
                    subscription_date: new Date(),
                    active: true,
                    verified: true,
                    status: 'Signed in with Google',
                    login_date: new Date(),
                    login_type: 'google'
                };
                var new_subscribe = new subscribers(new_subscribe_obj);
                await new_subscribe.save();

                existing_subscribe__id = new_subscribe._id.toString();
            }else {
                
                existing_subscribe__id = existing_subscribe._id.toString();

                var subscribe_update = {
                    $set: {
                        session_id: req.session_id,
                        active: true,
                        status: 'Signed in with Google',
                        login_date: new Date(),
                        login_type: 'google'
                    },
                    $unset:{
                        verification_code: null,
                        verification_code_expire_date: null
                    }
                };

                await subscribers.findByIdAndUpdate(existing_subscribe__id, subscribe_update);
            }

            var { token } = await create_jwt_token(req, res, jwt_token_expire_date_st, req.session_id, email_address, existing_subscribe__id);            
            var { created_refresh_token, hashed_refresh_token } = await create_refresh_session(existing_subscribe__id, req.session_id);

            console.log("created_refresh_token -> " + created_refresh_token);
            console.log("hashed_refresh_token -> " + hashed_refresh_token);

            //set_res_cookie(req, res, "jwt_token", token, jwt_token_cookie_expire_date_ms, '/');
            set_cookie_all_paths(req, res, 'jwt_token', token, jwt_token_cookie_expire_date_ms);
            set_res_cookie(req, res, "refresh_token", created_refresh_token, 30 * 24 * 60 * 60 * 1000, '/refresh');

            req.subscriber_id = existing_subscribe__id;

            res.set('Cache-Control','no-store');
            return res.status(200).json({ message:' You have successfully signed in with Google.', success: true });
        }catch(err){
            console.error(err);
            return res.status(500).json({ message:' google-login', success: false });
        }
    }
);

//Refresh session ile jwt yenileme servisi
app.get(
    '/refresh',
    rate_limiter,
    create_session_id,
    set_service_action_name({action: 'refresh'}),
    async(req, res) => {
        try{

            var refresh_token = extract_refresh_token(req);
            if( !refresh_token ) return res.status(400).json({ message:' refresh-token required. ', success: false });

            var refresh_token_hash = hash_refresh_token(refresh_token);

            var refresh_session_filter = {
                refresh_token_hash: refresh_token_hash,
                revoked_date: null
            };

            var refresh_session_detail = await refresh_session.findOne(refresh_session_filter).lean();

            if( !refresh_session_detail ) return res.status(404).json({ message:' refresh-session not found. ', success: false });
            if( new Date(String(refresh_session_detail.expired_date)) < new Date() ) return res.status(400).json({ message:' Your refresh token has expired. Please log in again.', success: false });

            var { _id, subscriber_id } = refresh_session_detail;
            var existing_subscribe = await subscribers.findById(subscriber_id).select('email_address').lean();
            var { email_address } = existing_subscribe;

            await clear_cookie_all_paths(req, res, "jwt_token");
            await clear_cookie_all_paths(req, res, "refresh_token");

            var { token } = await create_jwt_token(req, res, jwt_token_expire_date_st, req.session_id, email_address, subscriber_id);            
            //set_res_cookie(req, res, "jwt_token", token, jwt_token_cookie_expire_date_ms, '/');
            set_cookie_all_paths(req, res, 'jwt_token', token, jwt_token_cookie_expire_date_ms);

            var { created_refresh_token, hashed_refresh_token } = await create_refresh_session(subscriber_id, req.session_id);
            set_res_cookie(req, res, "refresh_token", created_refresh_token, 30 * 24 * 60 * 60 * 1000, '/refresh');

            var subscribe_update = {
                $set: {
                    session_id: req.session_id
                }
            };
            await subscribers.findByIdAndUpdate(subscriber_id, subscribe_update);

            req.subscriber_id = subscriber_id;

            res.set('Cache-Control','no-store');
            return res.status(200).json({ message:' The token has been successfully renewed.', success: true });
        }catch(err){
            console.error(err);
            return res.status(500).json({ message:' refresh service error. ', success: false });
        }
    }
);

//Çıkış yap servisi
app.post(
    '/logout',
    rate_limiter,
    verify_jwt_token,
    set_service_action_name({ action: 'logout'}),
    async(req, res) =>{
        try{

            var { email_address, session_id } = req;

            var subscribe_filter = { email_address: email_address };

            var existing_subscribe = await find_existing_subscriber(req, res, subscribe_filter, []);
            var { _id } = existing_subscribe;

            var subscribe_update = {
                $set: {
                    active: false,
                    status: 'The user session has been successfully closed.'
                },
                $unset:{
                    session_id: null
                }
            };

            await subscribers.findByIdAndUpdate(_id, subscribe_update);

            var refresh_session_filter = { session_id: session_id, subscriber_id: _id };
            var refresh_session_update = {
                $set: {
                    revoked_date: new Date()
                }
            };

            await refresh_session.findOneAndUpdate(refresh_session_filter, refresh_session_update);

            await clear_cookie_all_paths(req, res, "jwt_token");
            await clear_cookie_all_paths(req, res, "refresh_token");

            return res.status(200).json({ message: ' The user session has been successfully closed.', success: true });
        }catch(err){
            console.error(err);
            return res.status(500).json({ message:' logout service error. ', success: false });
        }
    }
);

module.exports = app;