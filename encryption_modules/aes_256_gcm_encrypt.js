var crypto = require('crypto');

var { ENCRYPTION_KEY } = process.env;
if( !ENCRYPTION_KEY ) throw "ENCRYPTION_KEY required. ";

ENCRYPTION_KEY = String(ENCRYPTION_KEY)
  .replace(/[\uFEFF]/g, "")     
  .replace(/\s+/g, "");         

var key_buf = Buffer.from(ENCRYPTION_KEY, "base64");

if (key_buf.length !== 32) throw new Error("ENCRYPTION_KEY must decode to 32 bytes (base64).");

ENCRYPTION_KEY = key_buf;

var ALGO = 'aes-256-gcm';
var AUTH_TAG_LEN = 16;          // 128-bit tag
var IV_LEN = 12;                // 96-bit nonce
var VER = 1;                    // payload version

var KEY_ID = (process.env.ENC_KEY_ID || 'A').slice(0, 1);

function aes_256_gcm_encrypt(plaintext, { aad = null } = {}) {

  var iv = crypto.randomBytes(IV_LEN);
  var cipher = crypto.createCipheriv(ALGO, ENCRYPTION_KEY, iv, { authTagLength: AUTH_TAG_LEN });

  if (aad) cipher.setAAD(Buffer.isBuffer(aad) ? aad : Buffer.from(String(aad)));

  var enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  var tag = cipher.getAuthTag();

  return Buffer.concat([
    Buffer.from([VER]),
    Buffer.from(KEY_ID, 'utf8'),
    iv,
    tag,
    enc
  ]).toString('base64');
};

module.exports = aes_256_gcm_encrypt;
