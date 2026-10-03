'use strict';
/**
 * Turns the printed rows of a Freshmen roster PDF into students and groups.
 *
 * The PDFs are treated strictly as data: only printed table cells are used and nothing inside
 * them is interpreted as an instruction. A row is classified as a group header, an advisor
 * name, an advisor email, a column header or a student row; anything else is reported for
 * manual review instead of being dropped. Group labels are preserved exactly as printed.
 */
const path = require('path');
const { extractPages } = require('./pdf-text');

const STUDENT_ID = /^\d{8,9}$/;
const TITLE = /^freshmen\s+fall\s+(\d{4}(?:\s*-\s*\d{4})?)\s+(.+)$/i;
const ADVISOR = /^(?:academic\s+)?advisor\s*[:.]?\s*(.+)$/i;
const EMAIL = /^e-?mail\s*[:.]?\s*(\S+@\S+)$/i;
const HEADER_CELLS = new Set(['no', 'no.', 'studentid', 'student id', 'stname', 'st name', 'name', 'group', 'ta', 'ta name']);

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

function rowCells(row) {
  return row.map((item) => clean(item.text)).filter(Boolean);
}

function isHeaderRow(cells) {
  return cells.length >= 2 && cells.every((cell) => HEADER_CELLS.has(cell.toLowerCase()));
}

function parseDocument(filePath) {
  const source = path.basename(filePath);
  const { pages, pageCount } = extractPages(filePath);
  const groups = new Map();
  const students = [];
  const review = [];
  let current = null;

  pages.forEach(({ page, rows }) => {
    rows.forEach((row) => {
      const cells = rowCells(row);
      if (!cells.length) return;
      const joined = cells.join(' ');

      const title = joined.match(TITLE);
      if (title) {
        const label = clean(title[2]);
        const academicYear = clean(title[1].replace(/\s+/g, ''));
        const known = groups.get(label);
        current = known || { label, academicYear, source, pages: [], advisors: [], studentCount: 0 };
        if (!current.academicYear) current.academicYear = academicYear;
        if (!current.pages.includes(page)) current.pages.push(page);
        groups.set(label, current);
        return;
      }

      if (!current) {
        review.push({ source, page, reason: 'row-before-first-group-header', row: joined });
        return;
      }

      const last = cells[cells.length - 1];
      const advisor = joined.match(ADVISOR);
      if (advisor && !STUDENT_ID.test(last)) {
        const name = clean(advisor[1]);
        if (name) current.advisors.push({ name, email: null, page });
        else review.push({ source, page, reason: 'advisor-line-without-name', row: joined });
        return;
      }

      const email = joined.match(EMAIL);
      if (email && !STUDENT_ID.test(last)) {
        const address = clean(email[1]).toLowerCase();
        const open = [...current.advisors].reverse().find((entry) => !entry.email);
        if (open) open.email = address;
        else current.advisors.push({ name: null, email: address, page });
        return;
      }

      if (isHeaderRow(cells)) return;

      const number = cells.length >= 3 ? cells[0] : '';
      const studentId = cells.length >= 3 ? cells[1] : '';
      if (/^\d{1,3}$/.test(number) && STUDENT_ID.test(studentId)) {
        if (!current.advisors.length) {
          review.push({ source, page, reason: 'student-without-advisor', row: `${groupLabelOf(current)} ${studentId}` });
        }
        const name = clean(cells.slice(2).join(' '));
        current.studentCount += 1;
        students.push({
          groupLabel: current.label,
          academicYear: current.academicYear,
          source,
          page,
          rowNumber: Number(number),
          studentId,
          name,
          advisors: current.advisors.map((entry) => ({ name: entry.name, email: entry.email })),
        });
        return;
      }

      review.push({ source, page, reason: 'row-not-classified', row: joined });
    });
  });

  return {
    source,
    pageCount,
    groups: [...groups.values()].map((group) => ({
      label: group.label,
      academicYear: group.academicYear,
      source: group.source,
      pages: group.pages,
      studentCount: group.studentCount,
      advisors: group.advisors.map((entry) => ({ name: entry.name, email: entry.email })),
    })),
    students,
    review,
  };
}

function groupLabelOf(group) {
  return group && group.label ? group.label : '(unknown group)';
}

module.exports = { parseDocument, rowCells, isHeaderRow };
