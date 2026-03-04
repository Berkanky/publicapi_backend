require("dotenv").config();

const express = require("express");
const app = express();

const crypto = require('crypto');
const helmet = require("helmet");

const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require('express-rate-limit');

const cors = require("cors");
const http = require("http");

const cookieParser = require('cookie-parser');
const mongoose = require("mongoose");

//İnsert Fonksiyonları.
var create_audit_log = require("./insert_operations/create_audit_log");
var shut_down_server_in_safety_mode = require("./functions/shut_down_server_in_safety_mode");

//Routes.
var routes = require("./routes/index");

var { 
  MONGODB_URI, 
  NODE_ENV, 
  TRUST_PROXY, 
  MONGODB_NAME, 
  BACKEND_VERSION
} = process.env;

var PORT = process.env.PORT || 3000;

if( !BACKEND_VERSION ) throw "BACKEND_VERSION required. ";
if( !MONGODB_NAME ) throw "Database name not found.";
if( !NODE_ENV ) throw "NODE_ENV required. ";
if( !TRUST_PROXY ) throw "TRUST_PROXY required. ";
if( !MONGODB_URI ) throw "MONGODB_URI required.";

app.set('trust proxy', TRUST_PROXY === 'true');
app.disable('x-powered-by');

app.use((req, res, next) => {
  res.on("finish", () => {
    console.log(
      req.method,
      req.originalUrl,
      res.statusCode
    );
  });
  next();
});

var suspiciousPatterns = [/\.php\b/i, /\.env\b/i, /wp-admin\b/i, /phpmyadmin\b/i];
app.use((req, res, next) => {
  if (suspiciousPatterns.some(function(i){   return i.test(req.originalUrl) } )) return res.status(404).send('Not found');
  return next();
});

var globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => {
    var ip = req.headers['cf-connecting-ip'] || req.ip;
    return ipKeyGenerator(ip); 
  }
});

app.use(globalLimiter);

mongoose
  .connect(MONGODB_URI, 
  { 
    dbName: MONGODB_NAME,
    maxPoolSize: 20,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 5000,
    maxIdleTimeMS: 30000
  })
  .then(async () => { 
    var app_db = mongoose.connection.db;
    app.locals.db = app_db;

    console.log("MongoDB connection completed. ");
  })
  .catch((err) => { 
    console.error("MongoDB connection failed:", err);
    return process.exit(1);
  });

var dev_origins = [];
var prod_origins = [];

var allowedOrigins = (NODE_ENV === 'production' ? prod_origins : dev_origins).filter(Boolean);

var corsOptions = {
  origin: function (origin, callback) {

    if (NODE_ENV === "production") {

      if (!origin) return callback(null, true);
      if (allowedOrigins.some(function (item) { return item === origin })) return callback(null, true);

      return callback(new Error("CORS: This origin is not authorized."));
    }

    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'If-None-Match'],
  credentials: true,
  optionsSuccessStatus: 204,
  preflightContinue: false
};

app.use((req, res, next) => {
  res.setHeader("Vary", "Origin");
  return next();
});

app.use(cors(corsOptions));

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },  
  crossOriginOpenerPolicy: false,                       
  referrerPolicy: { policy: "strict-origin-when-cross-origin" }, 
  contentSecurityPolicy: false                            
}));

if(NODE_ENV == "production") app.use(helmet.hsts({ maxAge: 15552000, includeSubDomains: true, preload: true }));

app.use(cookieParser());

app.use((req, res, next) => {
  req.id = crypto.randomUUID();

  req.source_ip = req.headers['cf-connecting-ip'] || req.ip || req.connection.remoteAddress;
  req.country_code = req.headers['cf-ipcountry'];

  res.setHeader("X-Request-Id", req.id);
  return next();
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '100kb', extended: true }));
app.use(express.static('public', { dotfiles: 'ignore' }));

app.use(create_audit_log);
app.use("/", routes);

var server = http.createServer(app);

app.use((req, res) => {
  return res.status(404).json({ error: 'Not Found.' });
});

app.use((err, req, res, next) => {
  return res.status(500).json({ error: 'Internal Server Error.' });
});

server.listen(PORT, () => { 
  console.log("Server running. ");
});

process.on('SIGTERM', shut_down_server_in_safety_mode);
process.on('SIGINT', shut_down_server_in_safety_mode);

process.on("uncaughtException", (err) => {
  console.error("Unexpected error!" + err);
});
process.on("unhandledRejection", (reason) => {
  console.error("Unexpected promise error!" + reason);
});

module.exports = app;