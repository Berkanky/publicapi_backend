var express = require("express");
var app = express.Router();

var crypto = require('crypto');

//schemas
var email_query_log = require("../schemas/email_query_log_schema");

//joi schemas
var email_detail_service_schema = require("../joi_schemas/email_detail_service_schema");

//middlewares
var rate_limiter = require("../middleware/rate_limiter");
var set_service_action_name = require("../middleware/set_service_action_name");
var create_session_id = require("../middleware/create_session_id");

//encryptions
var sha_256 = require("../encryption_modules/sha_256");

var server_cache = require("../cache");

var disposable_email_domains_cache_key = 'disposable_email_domains';
var cached_disposable_email_domains = [];

var tlds_cache_key = 'tlds';
var cached_tlds = [];

var tld_set = []; //new Set(["com", "net", "org", "io", "dev", "app", "co", "uk", "tr", "me", "ai", "info", "biz"]); // worker'dan cron ile IANA'dan çekilecek.
var free_provider_domains = new Set(["gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com", "proton.me", "protonmail.com"]);
var disposable_domains = []; //new Set(["mailinator.com", "tempmail.com", "10minutemail.com", "guerrillamail.com"]);
var role_based_locals = new Set(["info", "support", "sales", "admin", "billing", "contact", "hello", "team", "hr", "careers"]);

async function catch_redis_metadata(){

  try{
    cached_disposable_email_domains = await server_cache.get(disposable_email_domains_cache_key);
    cached_tlds = await server_cache.get(tlds_cache_key);

  }catch(err){
    console.error(err);
  }finally{
    tld_set = new Set(cached_tlds);
    disposable_domains = new Set(cached_disposable_email_domains);
  }
};

catch_redis_metadata();

//Domain Intelligence service.
var psl = require("psl");
var dns = require("node:dns").promises;

function normalize_email(email) {
  var raw = String(email || "").trim();

  raw = raw.replace(/\s+/g, "");

  var at_count = (raw.match(/@/g) || []).length;

  if (at_count !== 1) {
    return {
      is_valid: false,
      normalized_email: raw,
      reason: "email must contain exactly one @"
    };
  }

  var parts = raw.split("@");
  var local_part = parts[0];
  var domain = parts[1];

  if (!local_part || !domain) {
    return {
      is_valid: false,
      normalized_email: raw,
      reason: "local part or domain missing"
    };
  }

  var normalized_domain = domain.toLowerCase();

  return {
    is_valid: true,
    normalized_email: local_part + "@" + normalized_domain,
    local_part: local_part,
    domain: normalized_domain
  };
};

function parse_email_parts(normalized_email) {
  var parts = String(normalized_email).split("@");

  return {
    local_part: parts[0] || "",
    domain: parts[1] || ""
  };
};

function get_registrable_domain(domain) {
  var parsed = psl.parse(domain);

  return {
    input_domain: domain,
    tld: domain.split(".").pop() || null,
    suffix: parsed.tld || null,
    registrable_domain: parsed.domain || null,
    subdomain: parsed.subdomain || null,
    listed: parsed.listed || false
  };
};

async function resolve_dns_signals(domain) {
  var mx_records = [];
  var txt_records = [];
  var a_records = [];
  var aaaa_records = [];

  var mx_exists = false;
  var domain_exists = false;

  try {
    mx_records = await dns.resolveMx(domain);
    if (Array.isArray(mx_records) && mx_records.length > 0) {
      mx_exists = true;
      domain_exists = true;
    }
  } catch (err) {}

  try {
    txt_records = await dns.resolveTxt(domain);
    if (Array.isArray(txt_records) && txt_records.length > 0) {
      domain_exists = true;
    }
  } catch (err) {}

  try {
    a_records = await dns.resolve4(domain);
    if (Array.isArray(a_records) && a_records.length > 0) {
      domain_exists = true;
    }
  } catch (err) {}

  try {
    aaaa_records = await dns.resolve6(domain);
    if (Array.isArray(aaaa_records) && aaaa_records.length > 0) {
      domain_exists = true;
    }
  } catch (err) {}

  return {
    domain_exists: domain_exists,
    mx_exists: mx_exists,
    mx_records: mx_records,
    txt_records: txt_records,
    a_records: a_records,
    aaaa_records: aaaa_records,
    a_record_fallback: !mx_exists && (a_records.length > 0 || aaaa_records.length > 0)
  };
};

function detect_spf(txt_records) {
  var i = 0;
  var joined = "";

  for (i = 0; i < txt_records.length; i += 1) {
    joined = txt_records[i].join("");
    if (joined.toLowerCase().indexOf("v=spf1") === 0) {
      return {
        spf_present: true,
        spf_record: joined
      };
    }
  }

  return {
    spf_present: false,
    spf_record: null
  };
};

async function detect_dmarc(domain) {
  var target = "_dmarc." + domain;

  try {
    var txt_records = await dns.resolveTxt(target);
    var i = 0;
    var joined = "";

    for (i = 0; i < txt_records.length; i += 1) {
      joined = txt_records[i].join("");
      if (joined.toLowerCase().indexOf("v=dmarc1") === 0) {
        return {
          dmarc_present: true,
          dmarc_record: joined
        };
      }
    }

    return {
      dmarc_present: false,
      dmarc_record: null
    };
  } catch (err) {
    return {
      dmarc_present: false,
      dmarc_record: null
    };
  }
};

function is_free_provider_domain(domain) {
  return free_provider_domains.has(String(domain || "").toLowerCase());
};

function is_disposable_domain(domain) {
  return disposable_domains.has(String(domain || "").toLowerCase());
};

function is_role_based_local_part(local_part) {
  return role_based_locals.has(String(local_part || "").toLowerCase());
};

function is_tld_set(local_part) {
  return tld_set.has(String(local_part || "").toLowerCase());
};

function build_risk_score(input) {
  var score = 0;
  var signals = [];

  if (!input.syntax_valid) {
    score += 80;
    signals.push("syntax_invalid");
  }

  if (!input.valid_tld) {
    score += 45;
    signals.push("invalid_tld");
  }

  if (!input.domain_exists) {
    score += 35;
    signals.push("domain_not_resolved");
  }

  if (!input.mx_exists) {
    score += 25;
    signals.push("mx_missing");
  } else {
    score -= 15;
    signals.push("mx_present");
  }

  if (input.a_record_fallback) {
    score += 10;
    signals.push("a_record_fallback");
  }

  if (input.spf_present) {
    score -= 5;
    signals.push("spf_present");
  }

  if (input.dmarc_present) {
    score -= 5;
    signals.push("dmarc_present");
  }

  if (input.is_disposable) {
    score += 40;
    signals.push("disposable_domain");
  }

  if (input.is_free_provider) {
    score += 8;
    signals.push("free_provider");
  }

  if (input.is_role_based) {
    score += 12;
    signals.push("role_based_local_part");
  }

  if (score < 0) score = 0;
  if (score > 100) score = 100;

  return {
    score: score,
    level: score >= 50 ? "high" : score >= 21 ? "medium" : "low",
    signals: signals
  };
};

async function validate_email_service(email_address) {
  var email = email_address;

  var normalized = normalize_email(email);

  if (!normalized.is_valid) {
    throw create_error(400, "INVALID_EMAIL_FORMAT", normalized.reason);
  }

  var normalized_email = normalized.normalized_email;

  var email_parts = parse_email_parts(normalized_email);
  var domain_parts = get_registrable_domain(email_parts.domain);

  var valid_tld = is_tld_set(String(domain_parts.tld || ""));

  var dns_signals = await resolve_dns_signals(email_parts.domain);
  var spf_info = detect_spf(dns_signals.txt_records);
  var dmarc_info = await detect_dmarc(email_parts.domain);

  var disposable = is_disposable_domain(email_parts.domain) ||
                   (domain_parts.registrable_domain && is_disposable_domain(domain_parts.registrable_domain));

  var free_provider = is_free_provider_domain(email_parts.domain) ||
                      (domain_parts.registrable_domain && is_free_provider_domain(domain_parts.registrable_domain));

  var role_based = is_role_based_local_part(email_parts.local_part);

  var risk = build_risk_score({
    syntax_valid: normalized.is_valid,
    valid_tld: valid_tld,
    domain_exists: dns_signals.domain_exists,
    mx_exists: dns_signals.mx_exists,
    a_record_fallback: dns_signals.a_record_fallback,
    spf_present: spf_info.spf_present,
    dmarc_present: dmarc_info.dmarc_present,
    is_disposable: disposable,
    is_free_provider: free_provider,
    is_role_based: role_based
  });

  var response = {
    success: true,
    input: {
      email: email
    },
    normalized: {
      email: normalized_email,
      local_part: email_parts.local_part,
      domain: email_parts.domain,
      registrable_domain: domain_parts.registrable_domain,
      suffix: domain_parts.suffix,
      tld: domain_parts.tld
    },
    syntax: {
      is_valid: normalized.is_valid
    },
    dns: {
      domain_exists: dns_signals.domain_exists,
      mx_exists: dns_signals.mx_exists,
      mx_records: dns_signals.mx_records,
      a_record_fallback: dns_signals.a_record_fallback
    },
    auth: {
      spf_present: spf_info.spf_present,
      spf_record: spf_info.spf_record,
      dmarc_present: dmarc_info.dmarc_present,
      dmarc_record: dmarc_info.dmarc_record
    },
    classification: {
      is_disposable: disposable,
      is_free_provider: free_provider,
      is_role_based: role_based,
      is_business_email: !free_provider && !disposable
    },
    risk: risk,
    meta: {
      cache: "MISS",
      query_count: 1
    }
  };

  return response;
};

async function update_email_domain(out_response){

  var normalized_email_address = out_response?.input?.email;
  var hashed_normalized_email_address = sha_256(normalized_email_address);
  
  await email_query_log.findOneAndUpdate(
    { email_hash: hashed_normalized_email_address },
    {
      $set: {
        last_query_date: new Date()
      },
      $inc: {
        query_count: 1
      },
      $setOnInsert: {
        input_email: out_response?.input?.email || null,
        email_hash: hashed_normalized_email_address,
        normalized_email:  out_response?.normalized?.email || null,
        local_part: out_response?.normalized?.local_part || null,
        domain: out_response?.normalized?.domain || null,
        registrable_domain: out_response?.normalized?.registrable_domain || null,
        tld: out_response?.normalized?.tld || null,
        syntax_is_valid: out_response?.syntax?.is_valid,
        domain_exists: out_response?.dns?.domain_exists,
        spf_present: out_response?.auth?.spf_present,
        dmarc_present: out_response?.auth?.dmarc_present,
        is_disposable: out_response?.classification?.is_disposable,
        is_free_provider: out_response?.classification?.is_free_provider,
        is_role_based: out_response?.classification?.is_role_based,
        is_business_email: out_response?.classification?.is_business_email,
        risk_score: out_response?.risk?.score || null,
        risk_level: out_response?.risk?.level || null,
        risk_signals: out_response?.risk?.signals || [],
        cache_status: out_response?.meta?.cache || null,
      }
    },
    { upsert: true, new: true }
  );
};

app.post(
  "/email-intelligence",
  rate_limiter,
  create_session_id,
  set_service_action_name({action: 'email-intelligence'}),
  async(req, res) => {

    var { email_address } = req.body;

    var { error } = email_detail_service_schema.validate(req.body, { abortEarly: false });
    if( error) return res.status(400).json({errors: error.details.map(detail => detail.message), success: false });

    try{

      var cache_key = "email_intelligence:" +  email_address;
      var cached_email_address_detail = await server_cache.get(cache_key);
      if( cached_email_address_detail ) {
        
        await update_email_domain(cached_email_address_detail);

        res.set("X-Cache", "HIT");
        return res.status(200).json({ success: true, out_response: cached_email_address_detail });
      }

      var out_response = await validate_email_service(email_address);

      await update_email_domain(out_response);
      await server_cache.set(cache_key, out_response, 86400);

      res.set("X-Cache", "MISS");
      return res.status(200).json({ success: true, out_response: out_response });
    }catch(err){

      console.error(err);
      return res.status(500).json({ message:' email-intelligence', success: false });
    }
  }
);

module.exports = app;