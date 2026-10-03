'use strict';
/**
 * Cross-checks extracted roster rows and reports everything that must be reviewed by a human
 * (duplicates, conflicting group/advisor metadata, missing names, and gaps in the printed
 * "No." sequence, which would mean a printed row never made it into the extraction).
 */

/** @param {Array<{ source: string, students: any[], groups: any[], review: any[] }>} parsedDocuments */
function audit(parsedDocuments) {
  const review = parsedDocuments.flatMap((document) => document.review.map((item) => ({ ...item })));
  const students = [];
  const byId = new Map();

  for (const student of parsedDocuments.flatMap((document) => document.students)) {
    const previous = byId.get(student.studentId);
    if (previous) {
      const same = previous.name === student.name && previous.groupLabel === student.groupLabel;
      review.push({
        source: student.source,
        page: student.page,
        reason: same ? 'duplicate-student-id' : 'conflicting-student-id',
        row: `${student.studentId} ${student.name} (${student.groupLabel}) repeats ${previous.source} p.${previous.page} row ${previous.rowNumber}`,
      });
      continue;
    }
    byId.set(student.studentId, student);
    students.push(student);
    if (!student.name) review.push({ source: student.source, page: student.page, reason: 'missing-name', row: student.studentId });
    if (!student.groupLabel) review.push({ source: student.source, page: student.page, reason: 'missing-group', row: student.studentId });
  }

  const groups = new Map();
  for (const student of students) {
    const group = groups.get(student.groupLabel) || {
      label: student.groupLabel,
      academicYear: student.academicYear,
      sources: new Set(),
      advisors: new Map(),
      numbers: [],
      students: 0,
    };
    if (group.academicYear && student.academicYear && group.academicYear !== student.academicYear) {
      review.push({
        source: student.source,
        page: student.page,
        reason: 'conflicting-academic-year',
        row: `${group.label}: ${group.academicYear} vs ${student.academicYear}`,
      });
    }
    group.sources.add(student.source);
    group.students += 1;
    group.numbers.push(student.rowNumber);
    for (const advisor of student.advisors) {
      if (!advisor.email) continue;
      const known = group.advisors.get(advisor.email);
      if (known && advisor.name && known.name && known.name !== advisor.name) {
        review.push({
          source: student.source,
          page: student.page,
          reason: 'conflicting-advisor-name',
          row: `${group.label} ${advisor.email}: "${known.name}" vs "${advisor.name}"`,
        });
      }
      group.advisors.set(advisor.email, { name: advisor.name || (known ? known.name : null), email: advisor.email });
    }
    groups.set(group.label, group);
  }

  for (const group of groups.values()) {
    if (!group.advisors.size) {
      review.push({ source: [...group.sources].join(', '), page: null, reason: 'group-without-advisor-email', row: group.label });
    }
    for (const advisor of group.advisors.values()) {
      if (!advisor.name) {
        review.push({ source: [...group.sources].join(', '), page: null, reason: 'advisor-without-name', row: `${group.label}: ${advisor.email}` });
      }
    }
    const sorted = [...group.numbers].sort((a, b) => a - b);
    const expected = sorted.length ? sorted[sorted.length - 1] : 0;
    const missing = [];
    for (let n = sorted[0] === 1 ? 1 : 1; n <= expected; n += 1) if (!group.numbers.includes(n)) missing.push(n);
    if (sorted[0] !== 1) missing.unshift(`row numbers start at ${sorted[0]}`);
    if (missing.length) {
      review.push({
        source: [...group.sources].join(', '),
        page: null,
        reason: 'missing-row-numbers',
        row: `${group.label}: ${missing.length} gap(s) in the printed No. column: ${missing.slice(0, 12).join(', ')}${missing.length > 12 ? ' ...' : ''}`,
      });
    }
  }

  return {
    review,
    students,
    groups: [...groups.values()]
      .sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true }))
      .map((group) => ({
        label: group.label,
        academicYear: group.academicYear,
        sources: [...group.sources],
        students: group.students,
        advisors: [...group.advisors.values()].sort((a, b) => String(a.email).localeCompare(String(b.email))),
      })),
  };
}

module.exports = { audit };
