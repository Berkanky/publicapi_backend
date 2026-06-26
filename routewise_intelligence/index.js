var express = require("express");
var app = express.Router();

var axios = require('axios');
var crypto = require('crypto');
var mongoose = require('mongoose');
var Queue = require("bullmq").Queue;
var compression = require("compression");

//bullmq redis connection
var bullmq_redis = require("../bullmq_redis_connection/bullmq_redis");
var create_bullmq_joq_queue = require("../bullmq_redis_connection/create_bullmq_joq_queue");

//middlewares
var rate_limiter = require("../middleware/rate_limiter");
var set_service_action_name = require("../middleware/set_service_action_name");
var country_control = require("../middleware/country_control");
var verify_jwt_token = require("../jwt_modules/verify_jwt_token");

//functions
var format_date = require("../functions/format_date");
var get_week_bucket = require("../functions/get_week_bucket");
var format_date_yyyy_mm_dd = require("../functions/format_date_yyyy_mm_dd");
var find_country_by_lat_lng = require("../functions/country_finder");
var format_number = require("../functions/format_number");
var decode_google_encoded_polyline = require("../functions/decode_google_encoded_polyline");
var convert_second_to_normalized_string = require("../functions/convert_second_to_normalized_string");

//şemalar
var subscribers = require("../schemas/subscribers_schema");
var routewiserequest = require("../schemas/routewise_request_schema");
var routewiseroutes = require("../schemas/routewise_routes_schema");
var country_meta = require("../schemas/country_meta_schema");
var country_reference = require("../schemas/country_reference_schema");

//joi
var routewise_request_schema = require("../joi_schemas/routewise_request_schema");
var routewise_intelligence_status_detail_schema = require("../joi_schemas/routewise_intelligence_status_detail_schema");
var routewise_intelligence_detail = require("../joi_schemas/routewise_intelligence_detail_schema");

var sha_256 = require("../encryption_modules/sha_256");

//cache
var server_cache = require("../cache");
/*
  await server_cache.set(key, data, ttl_seconds);
  await server_cache.del(key);
  await server_cache.get(key);
*/

//rota hesaplama servisi.
app.post(
    "/route-intelligence",
    rate_limiter,
    verify_jwt_token,
    country_control,
    set_service_action_name({action: 'route-detail'}),
    async(req, res) => {

        var {
            avg_consumption,
            origin,
            destination,
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

            drive_type = drive_type.toLowerCase();
            fuel_type = fuel_type.toLowerCase();
            currency = currency.toUpperCase();

            var status, existing_routewise_request__id, key, fuel_price_period, country_meta_detail;

            var { 
                session_id, 
                subscriber_id, 
                selected_location_currency_code, 
                country_alpha_3_code, 
                country_alpha_2_code 
            } = req;

            key = 'currencies';
            var currencies = await server_cache.get(key);
            if( !currencies ) throw "currencies required. ";
            var { rates, base, date } = currencies;

            key = 'country_meta_' + country_alpha_2_code;
            country_meta_detail = await server_cache.get(key);
            if( !country_meta_detail ) {

                var country_meta_filter = { country_alpha_2_code: country_alpha_2_code};
                country_meta_detail = await country_meta.findOne(country_meta_filter).lean();
            }
            
            var { fuel_prices } = country_meta_detail;
            var fuel_price_detail = fuel_prices.find(function(item){ return item.energy_type === fuel_type.toUpperCase() });
            fuel_price_period = fuel_price_detail.period;

            var currency_hash = sha_256(JSON.stringify({selected_currency: currency.toLowerCase(), period: format_date_yyyy_mm_dd(date)}));
            var fuel_price_hash = sha_256(JSON.stringify({ fuel_type: fuel_type.toLowerCase(), currency_code: currency.toLowerCase(), period: get_week_bucket(fuel_price_period) }));
            var request_hash = sha_256(JSON.stringify(req.body));

            var routewise_request_filter = {
                request_hash,
                fuel_price_hash,
                currency_hash,
                status: 'completed',
                is_clone: false
            };
            
            var existing_routewise_request = await routewiserequest.findOne(routewise_request_filter).lean();
            if( !existing_routewise_request ) status = "It has been added to the queue";
            else {
                status = 'completed';
                existing_routewise_request__id = existing_routewise_request._id.toString();
            }

            var created_date = new Date();

            var new_routewise_request_obj = {
                session_id: session_id,
                subscriber_id: subscriber_id || null,
                request_hash: request_hash,
                fuel_price_hash: fuel_price_hash,
                currency_hash: currency_hash,
                calculation_hash: sha_256(JSON.stringify({request_hash, fuel_price_hash, currency_hash})),
                created_date: created_date,
                avg_consumption: avg_consumption,
                origin: origin,
                destination: destination,
                travel_mode: 'DRIVE',
                routing_preference: 'TRAFFIC_AWARE',
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
                    request_hash,
                    body: req.body,
                    subscriber_id: subscriber_id || null,
                    session_id: session_id,
                    country_alpha_3_code: country_alpha_3_code,
                    country_alpha_2_code: country_alpha_2_code,
                    created_date: created_date
                };

                var job = await job_queue.add(
                    "process_routewise_intelligence_worker",
                    job_payload
                );
            }

            if( existing_routewise_request ) res.set("X-Cache", "HIT");
            return res.status(200).json({ success: true, _id: created_routewise__id });
        }catch(err){
            console.error(err);
            return res.status(500).json({ message:' route-detail service error. ', success: false });
        }
    }
);

//status detail servisi.
app.get(
    '/route-intelligence-status-detail/:_id',
    rate_limiter,
    verify_jwt_token,
    set_service_action_name({action: 'routewise-intelligence-detail'}),
    async(req, res) => {

        var { subscriber_id } = req;
        var { _id } = req.params;

        var { error } = routewise_intelligence_status_detail_schema.validate(req.params, { abortEarly: false });
        if( error) return res.status(400).json({errors: error.details.map(detail => detail.message), success: false });

        try{

            var routewise_request_filter = {
                _id: _id,
                subscriber_id: subscriber_id
            };

            var existing_routewise_request = await routewiserequest.findOne(routewise_request_filter)
                .select("status job_id created_date calculation_hash")
                .lean();
            if( !existing_routewise_request ) return res.status(404).json({ message:' routewise_request not existing. ', success: false });

            existing_routewise_request.created_date = format_date(existing_routewise_request.created_date);
            return res.status(200).json({ success: true, routewise_request: existing_routewise_request });
        }catch(err){
            console.error(err);
            return res.status(500).json({ message: 'routewise-intelligence-detail service error. ', success: false });
        }
    }
);

//detail servisi.
app.get(
    "/route-intelligence-detail/:_id",
    rate_limiter,
    verify_jwt_token,
    set_service_action_name({action: 'route-intelligence-detail'}),
    compression(),
    async(req, res) => {

        var { subscriber_id } = req;
        var { _id } = req.params;

        var { error } = routewise_intelligence_detail.validate(req.params, { abortEarly: false });
        if( error) return res.status(400).json({errors: error.details.map(detail => detail.message), success: false });

        try{
            var existing_routewise_request;

            var key = 'routewiserequest_' + _id + '_' + subscriber_id;
            existing_routewise_request = await server_cache.get(key);

            if( existing_routewise_request ) {

                res.set("X-Cache", "HIT");
                return res.status(200).json({ success: true, routewise_request: existing_routewise_request });
            }

            existing_routewise_request = await routewiserequest.findById(_id)
                .select("-request_hash -currency_hash -fuel_price_hash -is_clone")
                .lean();
            if( !existing_routewise_request ) return res.status(404).json({ message:' routewise_request not existing. ', success: false });

            var { calculation_hash, created_date, duration_seconds, currency, fuel_price } = existing_routewise_request;
            
            existing_routewise_request.currency.period = format_date(currency.period);
            existing_routewise_request.currency.rate = format_number(currency.rate);

            existing_routewise_request.fuel_price.period = format_date(fuel_price.period);
            existing_routewise_request.fuel_price.value = format_number(fuel_price.value);

            existing_routewise_request.created_date = format_date(created_date);
            existing_routewise_request.duration_seconds_normalized = convert_second_to_normalized_string(duration_seconds);

            var routewise_routes_filter = { calculation_hash: calculation_hash };

            var routewise_routes = await routewiseroutes.find(routewise_routes_filter).lean();
            if( !routewise_routes.length ) return res.status(404).json({ message:' routes not existing.', success: false });

            var normalized_routes = [];
            for(var i = 0; i < routewise_routes.length; i++){

                var row = routewise_routes[i];
                var { 
                    distance_km, 
                    duration_seconds, 
                    avg_total_cost, 
                    avg_toll_road_cost, 
                    avg_fuel_cost_lt, 
                    fuel_consumed_liters,
                    encoded_polyline
                } = row;

                distance_km = format_number(distance_km);
                avg_total_cost = format_number(avg_total_cost);
                avg_toll_road_cost = format_number(avg_toll_road_cost);
                avg_fuel_cost_lt = format_number(avg_fuel_cost_lt);
                fuel_consumed_liters = format_number(fuel_consumed_liters);

                var decoded_polyline = decode_google_encoded_polyline(encoded_polyline);
                var duration_normalized = convert_second_to_normalized_string(duration_seconds);

                normalized_routes.push(
                    {
                        distance_km: distance_km,
                        avg_total_cost: avg_total_cost,
                        avg_toll_road_cost: avg_toll_road_cost,
                        avg_fuel_cost_lt: avg_fuel_cost_lt,
                        fuel_consumed_liters: fuel_consumed_liters,
                        duration_normalized: duration_normalized,
                        decoded_polyline: decoded_polyline
                    }
                );
            };

            Object.assign(existing_routewise_request, { routes: normalized_routes, is_routewise_request_detail_active: true });
            await server_cache.set(key, existing_routewise_request, 86400);
            
            return res.status(200).json({ success: true, routewise_request: existing_routewise_request });
        }catch(err){
            console.error(err);
            return res.status(500).json({ message:' route-intelligence-detail', success: false });
        }
    }
);

//Geçmiş requestler
app.get(
    "/route-history",
    rate_limiter,
    verify_jwt_token,
    set_service_action_name({action: 'history'}),
    async(req, res) => {
        try{

            var routewise_requests;
            var { subscriber_id } = req;

            var key = 'routewise_requests_' + subscriber_id;
            routewise_requests = await server_cache.get(key);
            if( routewise_requests ) {

                res.set("X-Cache", "HIT");
                return res.status(200).json({ message:' Previous calculations have been successfully retrieved.', success: true, routewise_requests: routewise_requests });
            }

            var routewise_request_filter = { subscriber_id: subscriber_id };

            routewise_requests = await routewiserequest.find(routewise_request_filter)
                .select("status job_id created_date calculation_hash session_id origin destination alternative_routes_count")
                .sort({ created_date: -1 })
                .lean();
            if( !routewise_requests ) return res.status(404).json({ message:' No results were found.', success: false });

            for(var i = 0; i < routewise_requests.length; i++){
                var row = routewise_requests[i];
                var { created_date } = row;

                row.created_date = format_date(created_date);
            };

            await server_cache.set(key, routewise_requests, 86400);
            return res.status(200).json({ message:' Previous calculations have been successfully retrieved.', success: true, routewise_requests: routewise_requests });
        }catch(err){
            console.error(err);
            return res.status(500).json({ message:' history service error.', success: false });
        }
    }
);

module.exports = app;