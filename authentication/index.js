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
var subscribers = require("../schemas/subscribers_schema");
var refresh_session = require("../schemas/refresh_session_schema");

//JOI
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
var { hash_refresh_token } = require("../refresh_token_modules/create_refresh_token");
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
    NODE_ENV, 
} = process.env;

if( !NODE_ENV ) throw "NODE_ENV required. ";

var jwt_token_cookie_expire_date_ms = NODE_ENV == 'production' ? 15 * 60 * 1000 : 50 * 60 * 1000;
var jwt_token_expire_date_st = NODE_ENV == 'production' ? '15m' : '2m';

var refresh_token_cookie_expire_date_ms = NODE_ENV == 'production' ? 30 * 24 * 60 * 60 * 1000 : 1 * 60 * 60 * 1000;

async function find_existing_subscriber(req, res, filter, columns){

    var existing_subscribe = await subscribers.findOne(filter).lean();
    if( !existing_subscribe ) return res.status(404).json({ message:' User not found.', success: false });

    return existing_subscribe;
};

//Abonelik kaydı başlat
app.post(
    '/send-email-address-verification',
    rate_limiter,
    email_address_verification,
    create_session_id,
    set_service_action_name({action: 'verify-email-address'}),
    async(req, res) => {

        var { session_id } = req;
        var { email_address } = req.body;

        var { error } = send_email_address_verification_schema.validate(req.body, { abortEarly: false });
        if( error) return res.status(400).json({errors: error.details.map(detail => detail.message), success: false });

        try{

            var subscriber_id;
            
            var job_payload = req.body;

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
                    verification_code_expire_date: verification_code_expire_date
                };

                var new_subscribe = new subscribers(new_subscribe_obj);
                await new_subscribe.save();

                subscriber_id = new_subscribe._id.toString();
            }

            var job_queue = await create_bullmq_joq_queue('email_address_verification_queue');

            job_payload.session_id = session_id;
            job_payload.verification_code = verification_code;

            var job = await job_queue.add(
                "send-email-address-verification",
                job_payload
            );

            await subscribers.findOneAndUpdate({ email_address: email_address }, { job_id: job.id });

            var { token } = await create_jwt_token(req, res, jwt_token_expire_date_st, session_id, email_address, subscriber_id);
            set_res_cookie(req, res, "jwt_token", token, jwt_token_cookie_expire_date_ms, '/email-address-verification');

            res.set('Cache-Control','no-store');
            return res.status(200).json({ messgae: 'Email verification has been initiated. Please check your email and complete the verification process.', success: true });
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

        var { email_address, subscriber_id, session_id } = req;
        var { verification_code } = req.body;

        var { error } = email_address_verification_schema.validate(req.body, { abortEarly: false });
        if( error) return res.status(400).json({errors: error.details.map(detail => detail.message), success: false });

        try{    

            var verification_code_hashed = sha_256(String(verification_code));

            var existing_subscribe = await subscribers.findById(subscriber_id).lean();
            var { _id } = existing_subscribe;

            if( existing_subscribe.verification_code !== verification_code_hashed ) return res.status(400).json({ message:' verification code invalid. ', success: false });
            if( new Date(String(existing_subscribe.verification_code_expire_date)) < new Date() ) return res.status(400).json({ message:' verification code is expired', success: false });

            var subscribe_update = {
                $set: {
                    session_id: session_id,
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

            var { token, jti } = await create_jwt_token(req, res, jwt_token_expire_date_st, session_id, email_address, _id);            
            var { created_refresh_token, hashed_refresh_token } = await create_refresh_session(_id, session_id, jti);

            set_cookie_all_paths(req, res, 'jwt_token', token, jwt_token_cookie_expire_date_ms);
            set_res_cookie(req, res, "refresh_token", created_refresh_token, refresh_token_cookie_expire_date_ms, '/refresh');

            res.set('Cache-Control','no-store');
            return res.status(200).json({ message:' Your subscription has been successfully processed.', success: true });
        }catch(err){
            console.error(err);
            return res.status(500).json({ message:' email-address-verification', success: false });
        }
    }
);

//Zaten abone ise giriş yap servisi.
app.post(
    "/login",
    rate_limiter,
    email_address_verification,
    create_session_id,
    set_service_action_name({ action: "login" }),
    async(req, res) => {

        var { email_address } = req.body;

        var { error } = send_email_address_verification_schema.validate(req.body, { abortEarly: false });
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
                    verification_code: verification_code_hashed,
                    verification_code_expire_date: calculate_expire_date({hours: 0, minutes: 15 })
                }
            };

            await subscribers.findByIdAndUpdate(_id, subscribe_update);

            var job_queue = await create_bullmq_joq_queue('email_address_verification_queue');

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

        var { email_address, subscriber_id, session_id } = req;
        var { verification_code } = req.body

        var { error } = email_address_verification_schema.validate(req.body, { abortEarly: false });
        if( error) return res.status(400).json({errors: error.details.map(detail => detail.message), success: false });

        try{

            var verification_code_hashed = sha_256(verification_code);

            var existing_subscribe = await subscribers.findById(subscriber_id).lean();
            var { _id } = existing_subscribe;

            if( !existing_subscribe.verified ) return res.status(403).json({ message:' Your account subscription is not active.', success: false });
            if( new Date(String(existing_subscribe.verification_code_expire_date)) < new Date() ) return res.status(400).json({ message: ' verification code expired. ', success: false });
            if( existing_subscribe.verification_code !== verification_code_hashed ) return res.status(400).json({ message:' verification code invalid. ', success: false });

            var subscribe_update = {
                $set: {
                    session_id: session_id,
                    active: true,
                    login_date: new Date(),
                    status: 'User login was successful',
                    login_type: 'email'
                },
                $unset:{
                    verification_code: null,
                    verification_code_expire_date: null
                }
            };
            await subscribers.findByIdAndUpdate(_id, subscribe_update);

            var { token, jti } = await create_jwt_token(req, res, jwt_token_expire_date_st, session_id, email_address, _id);  
            var { created_refresh_token, hashed_refresh_token } = await create_refresh_session(_id, session_id, jti);          
            
            clear_res_cookie(req, res, "jwt_token", '/login-verify');

            set_cookie_all_paths(req, res, 'jwt_token', token, jwt_token_cookie_expire_date_ms);
            set_res_cookie(req, res, "refresh_token", created_refresh_token, refresh_token_cookie_expire_date_ms, '/refresh');

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

            var { token, jti } = await create_jwt_token(req, res, jwt_token_expire_date_st, req.session_id, email_address, existing_subscribe__id);            
            var { created_refresh_token, hashed_refresh_token } = await create_refresh_session(existing_subscribe__id, req.session_id, jti);

            set_cookie_all_paths(req, res, 'jwt_token', token, jwt_token_cookie_expire_date_ms);
            set_res_cookie(req, res, "refresh_token", created_refresh_token, refresh_token_cookie_expire_date_ms, '/refresh');

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

            var { token, jti } = await create_jwt_token(req, res, jwt_token_expire_date_st, req.session_id, email_address, subscriber_id);            
            set_cookie_all_paths(req, res, 'jwt_token', token, jwt_token_cookie_expire_date_ms);

            var { created_refresh_token, hashed_refresh_token } = await create_refresh_session(subscriber_id, req.session_id, jti);
            set_res_cookie(req, res, "refresh_token", created_refresh_token, refresh_token_cookie_expire_date_ms, '/refresh');

            var subscribe_update = {
                $set: {
                    session_id: req.session_id
                }
            };
            await subscribers.findByIdAndUpdate(subscriber_id, subscribe_update);

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

            var { session_id, subscriber_id, jti } = req;

            var subscribe_update = {
                $set: {
                    active: false,
                    status: 'The user session has been successfully closed.'
                },
                $unset:{
                    session_id: null
                }
            };

            await subscribers.findByIdAndUpdate(subscriber_id, subscribe_update);

            var refresh_session_filter = { session_id: session_id, subscriber_id: subscriber_id };
            var refresh_session_update = {
                $set: {
                    revoked_date: new Date()
                }
            };

            await refresh_session.findOneAndUpdate(refresh_session_filter, refresh_session_update);

            await clear_cookie_all_paths(req, res, "jwt_token");
            await clear_cookie_all_paths(req, res, "refresh_token");

            var blacklist_key = 'blacklist:' + jti;
            var subscriber_key = "subscriber_" + subscriber_id;
            var revoked_jwt = {
                revoked: true,
                reason: 'logout',
                subscriber_id: subscriber_id,
                revoked_date: new Date()
            };

            await server_cache.set(blacklist_key, revoked_jwt, 900);
            await server_cache.del(subscriber_key);

            return res.status(200).json({ message: ' The user session has been successfully closed.', success: true });
        }catch(err){
            console.error(err);
            return res.status(500).json({ message:' logout service error. ', success: false });
        }
    }
);

//Oturum doğrulama servisi.
app.get(
    '/session-control',
    verify_jwt_token,
    set_service_action_name({action: 'session-control'}),
    async(req, res ) => {
        try{

            var { subscriber_id } = req;
            var existing_subscriber, active;

            var key = 'subscriber_' + subscriber_id;
            existing_subscriber = await server_cache.get(key);

            if( !existing_subscriber ) {

                existing_subscriber = await subscribers.findById(subscriber_id).select("active").lean();
                active = existing_subscriber.active;
            } else active = existing_subscriber.active;

            if( !active ) return res.status(400).json({ message:'Please log in again. ', success: false });
            return res.status(200).json({ success: true });
        }catch(err){
            console.error(err);
            return res.status(500).json({ success: false });
        }
    }
);

//Hesap bilgisi
app.get(
    '/auth',
    rate_limiter,
    verify_jwt_token,
    set_service_action_name({action: 'auth'}),
    async(req, res) => {
        try{    

            var {
                subscriber_id,
                session_id,
                email_address
            } = req;

            var key = 'subscriber_' + subscriber_id;
            var subscriber_detail = await server_cache.get(key);
            if( subscriber_detail ) {

                if( subscriber_detail.session_id === session_id ) {

                    res.set("X-Cache", "HIT");
                    return res.status(200).json({ success: true, user_data: subscriber_detail });
                } else await server_cache.del(key);
            }

            var existing_subscriber = await subscribers.findById(subscriber_id)
                .select("verified status login_date login_type subscription_date session_id")
                .lean();
            
            var { verified, status, login_date, login_type, subscription_date } = existing_subscriber;

            login_date = format_date(login_date);
            subscription_date = format_date(subscription_date);

            var avatar = email_address.charAt(0).toUpperCase();

            var user_data = { 
                verified,
                status,
                login_date,
                login_type,
                subscription_date,
                email_address,
                session_id,
                avatar
            };
            
            await server_cache.set(key, user_data, 86400);
            return res.status(200).json({ success: true, user_data: user_data });
        }catch(err){
            console.error(err);
            return res.status(500).json({ success: false });
        }
    }
);

module.exports = app;