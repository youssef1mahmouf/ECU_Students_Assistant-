'use strict';
/**
 * Role and permission matrix - the single source of truth for authorisation.
 *
 * Every role in the system is listed here with the exact capabilities it holds.
 * Route code asks `hasCap(role, cap)`; the frontend only receives the resulting
 * capability list (see lib/dto.js) so the UI can hide what the server would refuse.
 *
 * Roles:
 *   user                 student account (roster-driven)
 *   adminAssistant       read-only assistant; triages problem reports
 *   doctor, engineer     read-only academic/technical staff
 *   admin                full day-to-day management of groups, content, accounts
 *   superAdminAssistant  exactly admin-level, and never super-admin-only powers
 *                        (no role assignment, no staff-account management, no
 *                        protected-owner actions) - it is NOT a silent super admin
 *   superAdmin           everything, except actions blocked on the protected owner
 */

const ROLES = ['user', 'adminAssistant', 'superAdminAssistant', 'doctor', 'engineer', 'admin', 'superAdmin'];

/** Roles that may open the admin area at all. */
const STAFF_ROLES = ['adminAssistant', 'superAdminAssistant', 'doctor', 'engineer', 'admin', 'superAdmin'];

/** Any role other than the student role is privileged: only a super admin may assign it. */
const PRIVILEGED_ROLES = ROLES.filter((role) => role !== 'user');

const CAPABILITIES = [
  'adminArea',
  'dashboard',
  'groupsView',
  'groupsManage',
  'contentView',
  'contentManage',
  'subjectsManage',
  'documentsView',
  'documentsManage',
  'accountsView',
  'accountsManage',
  'accountsStaff',
  'rolesAssign',
  'activityView',
  'reportsView',
  'reportsManage',
  'problemsView',
  'problemsManage',
];

const READ_ONLY_STAFF = ['adminArea', 'dashboard', 'groupsView', 'contentView', 'documentsView', 'activityView'];

const MATRIX = {
  user: [],
  adminAssistant: [...READ_ONLY_STAFF, 'accountsView', 'reportsView', 'problemsView', 'problemsManage'],
  doctor: [...READ_ONLY_STAFF],
  engineer: [...READ_ONLY_STAFF],
  admin: [
    ...READ_ONLY_STAFF,
    'groupsManage',
    'contentManage',
    'subjectsManage',
    'documentsManage',
    'accountsView',
    'accountsManage',
    'reportsView',
    'reportsManage',
    'problemsView',
    'problemsManage',
  ],
  /* Deliberately identical to `admin`: never rolesAssign, never accountsStaff. */
  superAdminAssistant: [
    ...READ_ONLY_STAFF,
    'groupsManage',
    'contentManage',
    'subjectsManage',
    'documentsManage',
    'accountsView',
    'accountsManage',
    'reportsView',
    'reportsManage',
    'problemsView',
    'problemsManage',
  ],
  superAdmin: [...CAPABILITIES],
};

function isRole(role) {
  return ROLES.includes(role);
}

/** Capability list for a role; unknown roles get nothing (fail closed). */
function capabilitiesFor(role) {
  return Array.isArray(MATRIX[role]) ? [...MATRIX[role]] : [];
}

function hasCap(role, capability) {
  return capabilitiesFor(role).includes(capability);
}

/** Convenience: may this role open the admin area? */
function isStaff(role) {
  return hasCap(role, 'adminArea');
}

module.exports = { ROLES, STAFF_ROLES, PRIVILEGED_ROLES, CAPABILITIES, MATRIX, isRole, capabilitiesFor, hasCap, isStaff };
