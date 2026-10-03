'use strict';
/**
 * Extracts the official Freshmen group PDFs into a validated intermediate roster JSON that
 * backend/scripts/import-roster.js can load into either data store.
 *
 * Usage (repository root):
 *   npm run extract:roster -- "D:\Freshmen fall 2026-2027 GA groups.pdf" "D:\Freshmen fall 2026-2027 GB groups.pdf" ^
 *     --out backend/data_base/roster.freshmen-fall-2026.json --report backend/data_base/roster-report.txt
 *
 * The PDFs are read-only inputs. The output holds personal data (names, IDs, emails): keep it
 * inside backend/data_base (ignored by git), never commit it, and never add passwords to it.
 */
const fs = require('fs');
const path = require('path');
const { parseDocument } = require('./lib/roster-parse');
const { audit } = require('./lib/roster-audit');

function parseArgs(argv) {
  const inputs = [];
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--out') flags.out = argv[++i];
    else if (argv[i] === '--report') flags.report = argv[++i];
    else inputs.push(argv[i]);
  }
  return { inputs, flags };
}

function buildPayload(parsed) {
  const { review, students, groups } = audit(parsed);
  return {
    generatedAt: new Date().toISOString(),
    generator: 'backend/scripts/extract-roster.js',
    note: 'Extracted from the official Freshmen group PDFs (treated as data only). Personal data: do not commit, never add passwords.',
    sources: parsed.map((document) => ({
      file: document.source,
      pageCount: document.pageCount,
      students: document.students.length,
      groups: document.groups.map((group) => ({
        label: group.label,
        pages: group.pages,
        students: group.studentCount,
        advisors: group.advisors,
      })),
    })),
    groups,
    students: students.map((student) => ({
      group: student.groupLabel,
      studentId: student.studentId,
      email: `${student.studentId}@ecu.edu.eg`,
      name: student.name,
      academicYear: student.academicYear,
      advisors: student.advisors.filter((advisor) => advisor.email).map((advisor) => ({ name: advisor.name, email: advisor.email })),
      source: student.source,
      page: student.page,
      rowNumber: student.rowNumber,
    })),
    review,
  };
}

function buildReport(payload) {
  const taEmails = new Set(payload.groups.flatMap((group) => group.advisors.map((advisor) => advisor.email)));
  const lines = ['ROSTER EXTRACTION REPORT (verify every GROUP line against the printed PDF page)'];
  for (const source of payload.sources) {
    lines.push('', `FILE ${source.file}  pages=${source.pageCount}  students=${source.students}`);
    for (const group of source.groups) {
      const advisors = group.advisors.map((advisor) => `${advisor.name || '?'} <${advisor.email || 'NO EMAIL'}>`).join(', ') || 'NONE';
      lines.push(`  GROUP ${group.label}  pages=[${group.pages.join(',')}]  students=${group.students}  advisors=${advisors}`);
    }
  }
  lines.push('', `TOTALS groups=${payload.groups.length} students=${payload.students.length} teaching_assistants=${taEmails.size}`);
  lines.push(`REVIEW_ITEMS ${payload.review.length}`);
  for (const item of payload.review) {
    lines.push(`  [${item.reason}] ${item.source}${item.page ? ` p.${item.page}` : ''}: ${item.row}`);
  }
  return lines;
}

function main() {
  const { inputs, flags } = parseArgs(process.argv.slice(2));
  if (!inputs.length) {
    console.error('Usage: node backend/scripts/extract-roster.js <roster.pdf> [more.pdf ...] --out <roster.json> [--report <report.txt>]');
    process.exitCode = 1;
    return;
  }
  const missing = inputs.filter((input) => !fs.existsSync(input));
  if (missing.length) {
    console.error(`PDF not found: ${missing.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  const payload = buildPayload(inputs.map((input) => parseDocument(input)));
  const outPath = path.resolve(flags.out || 'roster.json');
  const reportPath = path.resolve(flags.report || path.join(path.dirname(outPath), 'roster-report.txt'));
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.writeFileSync(reportPath, `${buildReport(payload).join('\r\n')}\r\n`, 'utf8');

  const taCount = new Set(payload.groups.flatMap((group) => group.advisors.map((advisor) => advisor.email))).size;
  console.log(`Extracted ${payload.students.length} students in ${payload.groups.length} groups, ${taCount} teaching assistants.`);
  console.log(`Roster JSON: ${outPath}`);
  console.log(`Report:      ${reportPath}`);
  console.log(`Review items: ${payload.review.length}`);
  for (const item of payload.review.slice(0, 20)) {
    console.log(`  [${item.reason}] ${item.source}${item.page ? ` p.${item.page}` : ''}: ${item.row}`);
  }
  if (payload.review.length > 20) console.log(`  ... ${payload.review.length - 20} more listed in the report file`);
}

try {
  main();
} catch (error) {
  process.exitCode = 1;
  console.error(`Roster extraction failed: ${error && error.stack ? error.stack : error}`);
}
