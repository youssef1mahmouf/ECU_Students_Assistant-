'use strict';
/**
 * Loads a validated roster document into whichever data store the project is using.
 *
 * Accepted inputs: the document produced by backend/scripts/extract-roster.js (an object with
 * `students` and `groups`, each student carrying the printed source file/page) or the older
 * flat array of per-student rows with advisorName/advisorEmail. Passwords are rejected: the
 * roster is an allow-list of identities, never a credential store.
 *
 * Writes are idempotent:
 *   groups   matched by their exact printed label  -> created once, then metadata refreshed
 *   students matched by their normalised email     -> upserted, source page kept for audit
 *   staff    matched by the advisor email printed  -> upserted as type 'ta'
 * Existing user accounts, password hashes and roles are never read or written here.
 */
const config = require('../../src/config/env');
const v = require('../../src/lib/validate');

const DOMAIN = config.security.emailDomain;
const STUDENT_ID = /^\d{8,9}$/;
const SOURCE_LABEL = 'Freshmen fall 2026-2027 group PDFs';

function advisorList(row) {
  if (Array.isArray(row.advisors)) {
    return row.advisors
      .map((entry) => ({ name: String(entry.name || '').trim(), email: String(entry.email || '').trim().toLowerCase() }))
      .filter((entry) => entry.email);
  }
  if (row.advisorEmail) {
    return [{ name: String(row.advisorName || '').trim(), email: String(row.advisorEmail).trim().toLowerCase() }];
  }
  return [];
}

/** Validate every row before anything is written, so a bad PDF never reaches the database. */
function normalise(document) {
  const rows = Array.isArray(document) ? document : (Array.isArray(document.students) ? document.students : null);
  if (!rows || !rows.length) throw new Error('Roster document must contain a non-empty "students" list.');

  const students = [];
  const groups = new Map();
  const emails = new Set();
  const ids = new Set();
  const review = [];

  rows.forEach((row, index) => {
    const at = `row ${index + 1}`;
    const studentId = String(row.studentId || row.id || '').trim();
    if (!STUDENT_ID.test(studentId)) throw new Error(`${at}: student id "${studentId}" is not 8-9 digits.`);
    const email = String(row.email || `${studentId}@${DOMAIN}`).trim().toLowerCase();
    if (email !== `${studentId}@${DOMAIN}`) throw new Error(`${at}: email ${email} does not match ${studentId}@${DOMAIN}.`);
    const name = String(row.name || '').replace(/\s+/g, ' ').trim();
    if (!name || name.length > 160) throw new Error(`${at}: student name is missing or too long.`);
    const label = v.groupName(String(row.group || ''), { field: 'Group label' });
    if (/^(password|passwordhash|password_hash|secret|token)$/i.test(String(row.group || ''))) {
      throw new Error(`${at}: credential-like column found in the roster.`);
    }
    if (emails.has(email) || ids.has(studentId)) throw new Error(`${at}: duplicated student ${email}.`);
    emails.add(email);
    ids.add(studentId);

    const advisors = advisorList(row);
    if (!advisors.length) review.push(`${label}: no teaching assistant printed for ${at}`);
    for (const advisor of advisors) v.email(advisor.email, { field: 'Teaching assistant email' });

    const academicYear = String(row.academicYear || '').trim();
    const group = groups.get(label) || { label, academicYear, advisors: new Map(), students: 0, sources: new Set() };
    if (group.academicYear && academicYear && group.academicYear !== academicYear) {
      throw new Error(`${label}: conflicting academic year ${group.academicYear} vs ${academicYear}.`);
    }
    group.academicYear = group.academicYear || academicYear;
    group.students += 1;
    if (row.source) group.sources.add(String(row.source));
    for (const advisor of advisors) {
      const known = group.advisors.get(advisor.email);
      if (known && advisor.name && known.name && known.name !== advisor.name) {
        throw new Error(`${label}: conflicting teaching assistant name for ${advisor.email}.`);
      }
      group.advisors.set(advisor.email, { name: advisor.name || (known ? known.name : ''), email: advisor.email });
    }
    groups.set(label, group);

    students.push({
      email,
      studentId,
      name,
      group: label,
      type: 'student',
      advisorName: advisors[0] ? advisors[0].name : '',
      advisorEmail: advisors[0] ? advisors[0].email : '',
      taEmails: advisors.map((advisor) => advisor.email),
      academicYear: group.academicYear,
      source: String(row.source || SOURCE_LABEL),
      sourcePage: Number.isInteger(row.page) ? row.page : null,
      rowNumber: Number.isInteger(row.rowNumber) ? row.rowNumber : null,
    });
  });

  const declared = Array.isArray(document) ? [] : (Array.isArray(document.groups) ? document.groups : []);
  for (const entry of declared) {
    const label = v.groupName(String(entry.label || entry.name || ''), { field: 'Group label' });
    if (!groups.has(label)) groups.set(label, { label, academicYear: String(entry.academicYear || '').trim(), advisors: new Map(), students: 0, sources: new Set(entry.sources || []) });
    const group = groups.get(label);
    for (const advisor of advisorList(entry)) {
      v.email(advisor.email, { field: 'Teaching assistant email' });
      if (!group.advisors.has(advisor.email)) group.advisors.set(advisor.email, advisor);
    }
  }

  return {
    students,
    groups: [...groups.values()]
      .sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true }))
      .map((group) => ({
        label: group.label,
        academicYear: group.academicYear,
        students: group.students,
        sources: [...group.sources],
        advisors: [...group.advisors.values()].sort((a, b) => a.email.localeCompare(b.email)),
      })),
    review,
  };
}

module.exports = { normalise };
