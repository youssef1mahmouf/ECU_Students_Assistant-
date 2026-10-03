'use strict';
/**
 * Response projections. Nothing leaves the API through a raw database document:
 * passwordHash and session verifiers are stripped here, and each caller picks a view.
 */
const config = require('../config/env');
const { capabilitiesFor, hasCap } = require('./permissions');

/** The primary owner account: password reset / disable / delete are blocked server-side. */
function isProtectedOwner(user) {
  return Boolean(user) && String(user.email || '').toLowerCase() === config.security.protectedOwnerEmail;
}

const base = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  group: user.group || '',
  studentId: user.studentId || '',
  advisorName: user.advisorName || '',
  advisorEmail: user.advisorEmail || '',
  isTeachingAssistant: Boolean(user.isTeachingAssistant),
  taGroups: Array.isArray(user.taGroups) ? user.taGroups : [],
  confirmed: Boolean(user.confirmed),
  active: user.active !== false,
  createdAt: user.createdAt || null,
  lastLoginAt: user.lastLoginAt || null,
});

/** What the owner of the account may see about themselves. */
const selfView = (user) => base(user);

/** What staff may see in account-management screens. */
const staffView = (user) => ({
  ...base(user),
  updatedAt: user.updatedAt || null,
  // Server-derived hint so the UI can hide Password/Disable/Delete for the owner.
  // The server enforces the same rule regardless of what the browser does.
  protected: isProtectedOwner(user),
});

/** What a guest page may reveal - identity existence only, never PII. */
const publicView = (user) => ({ id: user.id, name: user.name });

/**
 * Permission hints for the UI. Authorisation decisions are still made server-side
 * (middleware/auth.js + lib/permissions.js); `capabilities` is the same list the
 * server enforces, so the UI never guesses what a role may do.
 */
function permissionsFor(user) {
  if (!user) {
    return {
      isAdmin: false,
      isSuperAdmin: false,
      isTeachingAssistant: false,
      canReadGroupContent: false,
      canAccessAdmin: false,
      capabilities: [],
      group: '',
    };
  }
  const capabilities = capabilitiesFor(user.role);
  const isAdmin = hasCap(user.role, 'adminArea');
  return {
    // A listed teaching assistant is deliberately not staff here: being printed in the roster
    // PDF gives access to student features only, never the admin area.
    isAdmin,
    canAccessAdmin: isAdmin,
    isSuperAdmin: user.role === 'superAdmin',
    isTeachingAssistant: Boolean(user.isTeachingAssistant),
    canReadGroupContent: isAdmin || (Boolean(user.group) && Boolean(user.confirmed)),
    group: user.group || '',
    capabilities,
  };
}

module.exports = { selfView, staffView, publicView, permissionsFor, isProtectedOwner };
