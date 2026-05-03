var crypto = require('crypto');

var { ENCRYPTION_KEY } = process.env;
if( !ENCRYPTION_KEY ) throw "ENCRYPTION_KEY required. ";

ENCRYPTION_KEY = String(ENCRYPTION_KEY)
  .replace(/[\uFEFF]/g, "")     // BOM
  .replace(/\s+/g, "");         // \r \n boşluk tab hepsini sil

var key_buf = Buffer.from(ENCRYPTION_KEY, "base64");

if (key_buf.length !== 32)   throw new Error("ENCRYPTION_KEY must decode to 32 bytes (base64).");

ENCRYPTION_KEY = key_buf;

var ALGO = 'aes-256-gcm';
var AUTH_TAG_LEN = 16; // 128-bit tag
var IV_LEN = 12; // 96-bit nonce
var VER = 1; // payload version

function aes_256_gcm_decrypt(payloadB64, { aad = null } = {}) {

  var buf = Buffer.from(payloadB64, 'base64');
  if (buf.length < 30) throw new Error('Malformed payload');

  var ver = buf.readUInt8(0);
  if (ver !== VER) throw new Error(`Unsupported version: ${ver}`);

  var kid = buf.subarray(1, 2).toString('utf8');
  var iv = buf.subarray(2, 2 + IV_LEN);
  var tag = buf.subarray(2 + IV_LEN, 2 + IV_LEN + AUTH_TAG_LEN);
  var enc = buf.subarray(2 + IV_LEN + AUTH_TAG_LEN);

  var decipher = crypto.createDecipheriv(ALGO, ENCRYPTION_KEY, iv, { authTagLength: AUTH_TAG_LEN });
  if (aad) decipher.setAAD(Buffer.isBuffer(aad) ? aad : Buffer.from(String(aad)));
  decipher.setAuthTag(tag);

  try {
    var dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    return dec.toString('utf8');
    
  } catch (e) {
    console.error(e);
    throw new Error('AUTHENTICATION_FAILED');
  }
};

module.exports = aes_256_gcm_decrypt;