'use strict';
/**
 * Writes a normalised roster into the active data store (see ./roster-store-import.js for
 * validation). Group metadata is refreshed but never emptied, students are upserted by email,
 * and printed teaching assistants are upserted as staff roster entries with role 'ta', which
 * the application maps to student-level access until an administrator grants something else.
 */
const { normalise } = require('./roster-store-import');

const SOURCE_LABEL = 'Freshmen fall 2026-2027 group PDFs';

function groupMetadata(group) {
  const advisors = group.advisors;
  return {
    advisorName: advisors.length ? advisors[0].name || '' : '',
    advisorEmail: advisors.length ? advisors[0].email : '',
    taNames: advisors.map((advisor) => advisor.name).filter(Boolean),
    taEmails: advisors.map((advisor) => advisor.email),
    academicYear: group.academicYear || '',
    rosterSource: SOURCE_LABEL,
  };
}

/**
 * @param {object|Array} document roster JSON document (extract-roster output) or legacy rows
 * @param {{ store: object, dryRun?: boolean }} options
 * @returns {Promise<object>} counts plus the per-source breakdown, for logging without PII
 */
async function importRosterDocument(document, { store, dryRun = false } = {}) {
  if (!store) throw new Error('importRosterDocument needs the data store.');
  const { students, groups, review } = normalise(document);
  const summary = {
    store: store.kind,
    groups: groups.length,
    groupsCreated: 0,
    groupsUpdated: 0,
    students: students.length,
    staff: 0,
    perSource: new Map(),
    review,
  };

  if (!dryRun) {
    for (const group of groups) {
      const metadata = groupMetadata(group);
      const existing = await store.findGroupByName(group.label);
      if (existing) {
        await store.updateGroup(existing.id, metadata);
        summary.groupsUpdated += 1;
      } else {
        await store.createGroup({
          name: group.label,
          description: '',
          createdBy: 'roster-import',
          ...metadata,
        });
        summary.groupsCreated += 1;
      }
    }
  }

  const staffByEmail = new Map();
  for (const group of groups) {
    for (const advisor of group.advisors) {
      const entry = staffByEmail.get(advisor.email) || {
        email: advisor.email,
        name: advisor.name || advisor.email,
        type: 'ta',
        staff: true,
        groups: [],
        academicYear: group.academicYear || '',
        source: group.sources[0] || SOURCE_LABEL,
      };
      if (!entry.name && advisor.name) entry.name = advisor.name;
      if (!entry.groups.includes(group.label)) entry.groups.push(group.label);
      staffByEmail.set(advisor.email, entry);
    }
  }
  summary.staff = staffByEmail.size;

  const rows = [
    ...students,
    ...[...staffByEmail.values()].map((entry) => ({
      ...entry,
      studentId: '',
      group: entry.groups[0] || '',
      taGroups: entry.groups,
    })),
  ];

  for (const student of students) {
    const bucket = summary.perSource.get(student.source) || { students: 0, groups: new Set() };
    bucket.students += 1;
    bucket.groups.add(student.group);
    summary.perSource.set(student.source, bucket);
  }

  if (!dryRun) await store.importRoster(rows);

  summary.perSource = [...summary.perSource.entries()].map(([source, bucket]) => ({
    source,
    students: bucket.students,
    groups: bucket.groups.size,
  }));
  return summary;
}

module.exports = { importRosterDocument };
