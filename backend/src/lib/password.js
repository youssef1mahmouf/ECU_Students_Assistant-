'use strict';
/**
 * Password hashing with Node's built-in scrypt (RFC 7914 memory-hard KDF).
 * Chosen over bcrypt/bcryptjs so the project adds no new dependency: Node ships scrypt,
 * it is memory-hard, and crypto.timingSafeEqual gives constant-time comparison.
 * Stored format: scrypt$N$r$p$<salt-hex>$<hash-hex>  (cost params stored with the hash)
 */
const crypto = require('crypto');
const { promisify } = require('util');

const scrypt = promisify(crypto.scrypt);
const KEY_LENGTH = 64;
const SALT_BYTES = 16;
const COST = { N: 16384, r: 8, p: 1 };

async function hashPassword(plain) {
  if (typeof plain !== 'string' || plain.length === 0) {
    throw new TypeError('Password must be a non-empty string.');
  }
  const salt = crypto.randomBytes(SALT_BYTES);
  const derived = await scrypt(normalize(plain), salt, KEY_LENGTH, { ...COST });
  return ['scrypt', COST.N, COST.r, COST.p, salt.toString('hex'), derived.toString('hex')].join('$');
}

async function verifyPassword(plain, stored) {
  if (typeof plain !== 'string' || typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, saltHex, hashHex] = parts;
  const params = { N: Number(n), r: Number(r), p: Number(p), maxmem: 256 * 1024 * 1024 };
  if (!Number.isFinite(params.N) || !Number.isFinite(params.r) || !Number.isFinite(params.p)) return false;
  let salt;
  let expected;
  try {
    salt = Buffer.from(saltHex, 'hex');
    expected = Buffer.from(hashHex, 'hex');
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length !== KEY_LENGTH) return false;
  let actual;
  try {
    actual = await scrypt(normalize(plain), salt, expected.length, params);
  } catch {
    return false;
  }
  return crypto.timingSafeEqual(actual, expected);
}

/** A bogus hash used to equalise response time when an account does not exist. */
const TIMING_SAFE_DUMMY = 'scrypt$16384$8$1$00000000000000000000000000000000$' + '0'.repeat(KEY_LENGTH * 2);

function normalize(password) {
  // Normalise unicode so identical-looking passwords hash the same, and strip
  // invisible whitespace a user may paste, without touching internal spaces.
  return password.normalize('NFKC').replace(/^[\s\u200b]+|[\s\u200b]+$/g, '');
}

module.exports = { hashPassword, verifyPassword, TIMING_SAFE_DUMMY, normalize };
