var ioredis = require("ioredis");
var crypto = require("crypto");

function env_true(name, fallback) {
  var v = process.env[name];
  if (v === undefined || v === null || v === "") return !!fallback;
  v = String(v).trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

function build_redis_conn() {
  var redis_url = process.env.REDIS_URL;
  if (redis_url && redis_url.length > 0) {
    return redis_url + (redis_url.indexOf("?") !== -1 ? "&" : "?") + "family=0";
  }

  var host = process.env.REDIS_HOST;
  var port = process.env.REDIS_PORT;
  var pass = process.env.REDIS_PASSWORD;

  if (!host || !port) return null;

  if (pass && pass.length > 0) {
    return "redis://:" + encodeURIComponent(pass) + "@" + host + ":" + port + "?family=0";
  }

  return "redis://" + host + ":" + port + "?family=0";
}

function safe_stringify(val) {
  try {
    return JSON.stringify(val);
  } catch (e) {
    return String(val);
  }
}

function safe_parse(val) {
  if (val === null || val === undefined) return null;
  try {
    return JSON.parse(val);
  } catch (e) {
    return val;
  }
}

function make_token() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return crypto.randomBytes(16).toString("hex");
}

var redis_enabled = env_true("REDIS_ENABLED", true);
var redis_conn = redis_enabled ? build_redis_conn() : null;

var redis = null;
var using_redis = false;

if (redis_conn) {
  try {
    redis = new ioredis(redis_conn, {
      maxRetriesPerRequest: 1,          // dev'de sonsuz bekleyip uygulamayı kilitlemesin
      enableReadyCheck: true,
      connectTimeout: 1500,
      retryStrategy: function (times) {
        // 0.05s -> 2s arası, sonra sabit
        var delay = times * 50;
        if (delay > 2000) delay = 2000;
        return delay;
      },
    });

    using_redis = true;

    redis.on("connect", function () {
      console.log("✅ redis_connected");
    });

    redis.on("ready", function () {
      console.log("🚀 redis_ready");
    });

    redis.on("error", function (e) {
      console.error("redis_error:", e && e.message ? e.message : e);
    });

    redis.on("end", function () {
      console.error("redis_end: connection closed");
    });
  } catch (err) {
    console.error("redis_init_error:", err && err.message ? err.message : err);
    using_redis = false;
    redis = null;
  }
}

function is_enabled() {
  return using_redis && !!redis;
}

async function acquire_lock(key, ttl_seconds) {
  if (!is_enabled()) return null;
  if (!ttl_seconds || ttl_seconds <= 0) ttl_seconds = 120;

  var token = make_token();
  try {
    var res = await redis.set(key, token, "NX", "EX", ttl_seconds);
    return res === "OK" ? token : null;
  } catch (err) {
    return null;
  }
}

async function release_lock(key, token) {
  if (!is_enabled() || !token) return false;

  var script =
    'if redis.call("get", KEYS[1]) == ARGV[1] then ' +
    'return redis.call("del", KEYS[1]) ' +
    "else return 0 end";

  try {
    var res = await redis.eval(script, 1, key, token);
    return Number(res) > 0;
  } catch (err) {
    return false;
  }
}

async function extend_lock(key, token, ttl_seconds) {
  if (!is_enabled() || !token) return 0;
  if (!ttl_seconds || ttl_seconds <= 0) ttl_seconds = 120;

  var script =
    'if redis.call("get", KEYS[1]) == ARGV[1] then ' +
    'return redis.call("expire", KEYS[1], ARGV[2]) ' +
    "else return 0 end";

  try {
    var res = await redis.eval(script, 1, key, token, ttl_seconds);
    return Number(res) || 0;
  } catch (err) {
    return 0;
  }
}

async function get(key) {
  if (!is_enabled()) return null;
  try {
    var v = await redis.get(key);
    return safe_parse(v);
  } catch (err) {
    return null;
  }
}

async function set(key, val, ttl_seconds) {
  if (!is_enabled()) return false;
  if (ttl_seconds === undefined || ttl_seconds === null) ttl_seconds = 600;

  try {
    var s = safe_stringify(val);
    if (ttl_seconds > 0) {
      await redis.set(key, s, "EX", ttl_seconds);
    } else {
      await redis.set(key, s);
    }
    return true;
  } catch (err) {
    return false;
  }
}

async function del(key) {
  if (!is_enabled()) return false;
  try {
    await redis.del(key);
    return true;
  } catch (err) {
    return false;
  }
}

async function has(key) {
  if (!is_enabled()) return false;
  try {
    var exists = await redis.exists(key);
    return exists === 1;
  } catch (err) {
    return false;
  }
}

module.exports = {
  is_enabled: is_enabled,
  acquire_lock: acquire_lock,
  release_lock: release_lock,
  extend_lock: extend_lock,
  get: get,
  set: set,
  del: del,
  has: has,
};