'use strict';
/* Prints the storage path produced for a set of uploads, so the on-disk tree can be checked
   without uploading anything. Run: node backend/scripts/show-storage-layout.js */
const documents = require('../src/services/documents');

const CASES = [
  { label: 'PDF in Lecture 2', args: { subject: 'mathematics', week: 1, sessionKind: 'lecture', sessionNumber: 2, ext: 'pdf', filename: 'Function sheet.pdf' } },
  { label: 'video in Lecture 2', args: { subject: 'mathematics', week: 1, sessionKind: 'lecture', sessionNumber: 2, ext: 'mp4', filename: 'Video Project 3.mp4' } },
  { label: 'image in Lecture 2', args: { subject: 'mathematics', week: 1, sessionKind: 'lecture', sessionNumber: 2, ext: 'jpeg', filename: 'WhatsApp Image 2026-09-28.jpeg' } },
  { label: 'recording in Lecture 2', args: { subject: 'mathematics', week: 1, sessionKind: 'lecture', sessionNumber: 2, ext: 'm4a', filename: 'Video Project 5.m4a' } },
  { label: 'word in Lab 1', args: { subject: 'chemistry', week: 3, sessionKind: 'lab', sessionNumber: 1, ext: 'docx', filename: 'Lab sheet.docx' } },
  { label: 'tutorial 3', args: { subject: 'physics', week: 2, sessionKind: 'tutorial', sessionNumber: 3, ext: 'pdf', filename: 'Notes.pdf' } },
  { label: 'hostile name', args: { subject: 'physics', week: 1, sessionKind: 'lecture', sessionNumber: 1, ext: 'pdf', filename: '../../../Windows/System32/evil.pdf' } },
];

console.log('storage root: backend/data_base/documents\n');
for (const { label, args } of CASES) {
  const key = documents.buildStorageKey(args);
  const escaped = key.includes('..') ? '  <-- ESCAPES THE FOLDER' : '';
  console.log(`${label.padEnd(22)} ${key}${escaped}`);
}

console.log('\ntype folders:', [...new Set(CASES.map((c) => documents.storageFolder(c.args.ext)))].join(', '));

console.log('\nsame name twice reuses the slot (replaces):',
  documents.documentSlot(CASES[0].args) === documents.documentSlot(CASES[0].args));
console.log('different name is a new slot (adds):',
  documents.documentSlot(CASES[0].args) !== documents.documentSlot(CASES[1].args));