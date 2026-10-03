'use strict';
/**
 * Server-side input validation/normalisation. Every value crossing the trust boundary
 * goes through here: untrusted input is never stored, compared, or echoed as-is.
 */
const { ApiError } = require('./errors');
const config = require('../config/env');

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

function str(value, { field, min = 1, max = 500, optional = false, trim = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (optional) return '';
    throw ApiError.badRequest(`${field} is required.`);
  }
  if (typeof value !== 'string') throw ApiError.badRequest(`${field} must be text.`);
  let out = trim ? value.trim() : value;
  if (CONTROL_CHARS.test(out)) throw ApiError.badRequest(`${field} contains invalid characters.`);
  if (out.length < min) {
    if (optional) return '';
    throw ApiError.badRequest(`${field} must be at least ${min} characters.`);
  }
  if (out.length > max) throw ApiError.badRequest(`${field} must be under ${max} characters.`);
  return out;
}

function email(value, { field = 'Email', required = true } = {}) {
  let raw;
  if (value === undefined || value === null || value === '') {
    if (!required) return '';
    throw ApiError.badRequest(`${field} is required.`);
  }
  if (typeof value !== 'string') throw ApiError.badRequest(`${field} must be text.`);
  raw = value.normalize('NFKC').trim().toLowerCase();
  if (raw.length > 254) throw ApiError.badRequest(`${field} is too long.`);
  if (!/^[^\s@]+@[^\s@]+(\.[^\s@]+)+$/.test(raw)) throw ApiError.badRequest(`${field} is not valid.`);
  if (CONTROL_CHARS.test(raw)) throw ApiError.badRequest(`${field} is not valid.`);
  const domain = raw.split('@')[1];
  if (config.security.enforceEmailDomain && domain !== config.security.emailDomain) {
    throw ApiError.badRequest(`${field} must end with @${config.security.emailDomain}.`);
  }
  return raw;
}

function password(value, { field = 'Password' } = {}) {
  if (typeof value !== 'string') throw ApiError.badRequest(`${field} must be text.`);
  const min = config.security.minPasswordLength;
  if (value.length < min) throw ApiError.badRequest(`${field} must be at least ${min} characters.`);
  if (value.length > 200) throw ApiError.badRequest(`${field} is too long.`);
  if (/[\u0000-\u001f\u007f]/.test(value)) throw ApiError.badRequest(`${field} contains invalid characters.`);
  // Mirrors the policy the sign-up form advertises: upper case, digit and symbol.
  if (!/(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])/.test(value)) {
    throw ApiError.badRequest(`${field} needs an upper-case letter, a number and a symbol (e.g. @).`);
  }
  return value;
}

function oneOf(value, allowed, { field = 'Value' } = {}) {
  if (!allowed.includes(value)) throw ApiError.badRequest(`${field} must be one of: ${allowed.join(', ')}.`);
  return value;
}

function boolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const text = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(text)) return true;
  if (['0', 'false', 'no', 'off'].includes(text)) return false;
  return fallback;
}

/** Opaque identifiers only - never a Mongo ObjectId built from raw user input. */
function id(value, { field = 'Identifier' } = {}) {
  if (typeof value !== 'string') throw ApiError.badRequest(`${field} is invalid.`);
  const raw = value.trim();
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(raw)) throw ApiError.badRequest(`${field} is invalid.`);
  return raw;
}

/** Group names are user-supplied and reused in URLs, so keep them to a safe alphabet. */
function groupName(value, { field = 'Group name' } = {}) {
  const raw = str(value, { field, min: 2, max: 60 });
  if (!/^[^\s/\\:?#%&<>"]([\w\u0600-\u06FF .()+-]*[^\s/\\:?#%&<>"])$/.test(raw)) {
    throw ApiError.badRequest(`${field} may contain letters, numbers, spaces, . ( ) + - only.`);
  }
  return raw;
}

/** Subject slugs are used as directory names, so the alphabet is deliberately tiny. */
function subjectSlug(value, { field = 'Subject' } = {}) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,47}$/.test(raw)) {
    throw ApiError.badRequest(`${field} must be a short reference such as "math-1" (letters, numbers, hyphens).`);
  }
  return raw;
}

/**
 * The content kinds the portal supports (the same set the UI offers in its select).
 * Free-text kinds are refused so every record stays classifiable and translatable;
 * empty is allowed - kind is optional on a record.
 */
const CONTENT_KINDS = ['Assignment', 'Exam', 'Quiz', 'Project', 'Note', 'Lecture'];

function contentKind(value, { field = 'Kind' } = {}) {
  if (value === undefined || value === null || value === '') return '';
  const raw = typeof value === 'string' ? value.trim() : '';
  if (raw === '') return '';
  if (!CONTENT_KINDS.includes(raw)) {
    throw ApiError.badRequest(`${field} must be one of: ${CONTENT_KINDS.join(', ')}.`);
  }
  return raw;
}

/** Require an object body and return only the whitelisted keys (mass-assignment guard). */
function pick(body, keys) {
  const source = body && typeof body === 'object' ? body : {};
  const out = {};
  for (const key of keys) if (Object.prototype.hasOwnProperty.call(source, key)) out[key] = source[key];
  return out;
}

module.exports = {
  str,
  email,
  password,
  oneOf,
  boolean,
  id,
  groupName,
  subjectSlug,
  contentKind,
  CONTENT_KINDS,
  pick,
};
