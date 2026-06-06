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
var country_control = require("../middleware/country_control");

//functions
var format_date = require("../functions/format_date");
var normalize_google_compute_routes_distance_details = require("../functions/normalize_google_compute_routes_distance_details");
var get_week_bucket = require("../functions/get_week_bucket");
var format_date_yyyy_mm_dd = require("../functions/format_date_yyyy_mm_dd");
var find_country_by_lat_lng = require("../functions/country_finder");

//şemalar
var subscribers = require("../schemas/subscribers_schema");
var routewiserequest = require("../schemas/routewise_request_schema");
var routewiseroutes = require("../schemas/routewise_routes_schema");
var country_meta = require("../schemas/country_meta_schema");
var country_reference = require("../schemas/country_reference_schema");

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
    country_control,
    create_session_id,
    set_service_action_name({action: 'route-detail'}),
    async(req, res) => {

        var {
            email_address,
            avg_consumption,
            origin,
            destination,
            travel_mode,
            routing_preference,
            compute_alternative_routes,
            person,
            luggage_kg,
            drive_type,
            fuel_type,
            currency
        } = req.body;

        var { error } = routewise_request_schema.validate(req.body, { abortEarly: false });
        if( error) return res.status(400).json({errors: error.details.map(detail => detail.message), success: false });

        try{      
            var status, existing_routewise_request__id, key, fuel_price_period, country_meta_detail;

            var { session_id, subscriber_id, selected_location_currency_code, country_alpha_3_code, country_alpha_2_code } = req;

            key = 'currencies';
            var currencies = await server_cache.get(key);
            if( !currencies ) throw "currencies required. ";
            var { rates, base, date } = currencies;

            var currency_hash = sha_256(JSON.stringify({selected_currency: currency.toLowerCase(), period: format_date_yyyy_mm_dd(date)}));

            key = 'country_meta_' + country_alpha_2_code;
            country_meta_detail = await server_cache.get(key);
            if( !country_meta_detail ) {

                var country_meta_filter = { country_alpha_2_code: country_alpha_2_code};
                country_meta_detail = await country_meta.findOne(country_meta_filter).lean();
            }
            
            var { fuel_prices } = country_meta_detail;
            var fuel_price_detail = fuel_prices.find(function(item){ return item.energy_type === fuel_type.toUpperCase() });
            fuel_price_period = fuel_price_detail.period;

            var fuel_price_hash = sha_256(JSON.stringify({ fuel_type: fuel_type.toLowerCase(), currency_code: currency.toLowerCase(), period: get_week_bucket(fuel_price_period) }));
            var request_hash = sha_256(JSON.stringify(req.body));

            var routewise_request_filter = {
                request_hash,
                fuel_price_hash,
                currency_hash,
                status: 'completed'
            };
            
            var existing_routewise_request = await routewiserequest.findOne(routewise_request_filter).lean();
            if( !existing_routewise_request ) status = "It has been added to the queue";
            else {
                status = 'completed';
                existing_routewise_request__id = existing_routewise_request._id.toString();
            }

            var new_routewise_request_obj = {
                session_id: session_id,
                subscriber_id: subscriber_id || null,
                request_hash: request_hash,
                fuel_price_hash: fuel_price_hash,
                currency_hash: currency_hash,
                calculation_hash: sha_256(JSON.stringify({request_hash, fuel_price_hash, currency_hash})),
                created_date: new Date(),
                avg_consumption: avg_consumption,
                origin: origin,
                destination: destination,
                travel_mode: travel_mode,
                routing_preference: routing_preference,
                compute_alternative_routes: compute_alternative_routes,
                person,
                luggage_kg,
                drive_type,
                fuel_type,
                status: status,
                country_alpha_2_code: country_alpha_2_code
            };

            if( existing_routewise_request ){

                var { alternative_routes_count, currency, fuel_price } = existing_routewise_request;
                Object.assign(new_routewise_request_obj, {
                    alternative_routes_count,
                    currency,
                    fuel_price,
                    is_clone: true
                });
            }

            var new_routewise_request = new routewiserequest(new_routewise_request_obj);
            await new_routewise_request.save();

            var created_routewise__id = new_routewise_request._id.toString();

            if( !existing_routewise_request ) {

                var job_queue = await create_bullmq_joq_queue("routewise_intelligence_worker");
                var job_payload = {
                    created_routewise__id,
                    email_address,
                    request_hash,
                    body: req.body,
                    subscriber_id: subscriber_id || null,
                    session_id: session_id,
                    country_alpha_3_code: country_alpha_3_code,
                    country_alpha_2_code: country_alpha_2_code
                };

                var job = await job_queue.add(
                    "process_routewise_intelligence_worker",
                    job_payload
                );
            }

            if( existing_routewise_request ) res.set("X-Cache", "HIT");
            return res.status(200).json({ success: true, session_id: session_id });
        }catch(err){
            console.error(err);
            return res.status(500).json({ message:' route-detail service error. ', success: false });
        }
    }
);

module.exports = app;