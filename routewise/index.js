var express = require("express");
var app = express.Router();

var axios = require('axios');
var crypto = require('crypto');
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
var normalize_google_compute_routes_distance_details = require("../functions/normalize_google_compute_routes_distance_details");

//şemalar
var subscribers = require("../schemas/subscribers_schema");
var routewiserequest = require("../schemas/routewise_request_schema");

//joi
var routewise_request_schema = require("../joi_schemas/routewise_request_schema");

var sha_256 = require("../encryption_modules/sha_256");

//cache
var server_cache = require("../cache");
/*
  await server_cache.set(key, data, ttl_seconds);
  await server_cache.del(key);
  await server_cache.get(key);
*/

app.post(
    "/route-intelligence",
    rate_limiter,
    email_address_verification,
    create_session_id,
    set_service_action_name({action: 'route-detail'}),
    async(req, res) => {

        var {
            email_address,
            route_description, 
            avg_consumption,
            origin,
            destination,
            travel_mode,
            routing_preference,
            compute_alternative_routes,
            person,
            luggage,
            drive_type,
            fuel_type,
            currency
        } = req.body;

        console.log("Req Body -> " + JSON.stringify(req.body));

        var { error } = routewise_request_schema.validate(req.body, { abortEarly: false });
        if( error) return res.status(400).json({errors: error.details.map(detail => detail.message), success: false });

        try{      

            var { session_id, subscriber_id } = req;

            var request_hash = sha_256(JSON.stringify(req.body));

            var new_routewise_request_obj = {
                route_description: route_description,
                session_id: session_id,
                request_hash: request_hash,
                created_date: new Date(),
                avg_consumption: avg_consumption,
                origin: origin,
                destination: destination,
                travel_mode: travel_mode,
                routing_preference: routing_preference,
                compute_alternative_routes: compute_alternative_routes,
                person,
                luggage,
                drive_type,
                fuel_type,
                status: "in-progress"
            };

            var new_routewise_request = new routewiserequest(new_routewise_request_obj);
            await new_routewise_request.save();

            var created_routewise__id = new_routewise_request._id.toString();

            var job_queue = await create_bullmq_joq_queue("routewise_intelligence_worker");

            var job_payload = {
                created_routewise__id,
                email_address,
                request_hash,
                body: req.body,
                subscriber_id: subscriber_id || null,
                session_id: session_id
            };

            var job = await job_queue.add(
                "process_routewise_intelligence_worker",
                job_payload
            );
            
            return res.status(200).json({ success: true, session_id: session_id });
        }catch(err){
            console.error(err);
            return res.status(500).json({ message:' route-detail service error. ', success: false });
        }
    }
);

module.exports = app;