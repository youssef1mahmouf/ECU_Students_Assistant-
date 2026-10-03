'use strict';
/**
 * Indexes the teaching-material library into one JSON file. No bytes are copied.
 *
 *   npm run import:library
 *   node backend/scripts/import-material-library.js "G:\ECU"
 *   node backend/scripts/import-material-library.js "G:\ECU" --out some\path.json
 *   node backend/scripts/import-material-library.js "G:\ECU" --check      (report only)
 *
 * The source layout is the one the faculty already uses:
 *
 *   <Subject>\Week <n>\<Lecture|Tutorial|Lab|...>\<TYPE>\<file>
 *
 * TYPE is the folder that says what a file is (PDF, Imge, V, RE, Word). That convention is
 * preserved exactly in the output, so the index reads like the disk it came from.
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const valueOf = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
};
const positional = args.filter((a) => !a.startsWith('--'));

const SOURCE = (positional[0] || 'G:\\ECU').replace(/[\\/]+$/, '');
const OUT = path.resolve(valueOf('out') || path.join(__dirname, '..', 'data_base', 'material-library.json'));
const CHECK_ONLY = flag('check');

/* Folder name -> semantic type. Compared without case so "imge" and "Imge" agree. */
const TYPES = {
  pdf: 'pdf',
  word: 'word',
  doc: 'word',
  docx: 'word',
  imge: 'image',
  image: 'image',
  img: 'image',
  v: 'video',
  video: 'video',
  re: 'recording',
  rec: 'recording',
  r: 'recording',
};
const SESSION_KINDS = ['lecture', 'tutorial', 'lab', 'section', 'seminar'];

const slugify = (value) =>
  String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
const extOf = (name) => path.extname(name).replace(/^\./, '').toLowerCase();
const readDirSafe = (dir) => {
  try { return fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
};

/** "Week 3" -> 3; anything else is not a week folder. */
function weekOf(name) {
  const match = String(name).trim().match(/^week\s*0*(\d{1,2})$/i);
  return match ? Number(match[1]) : null;
}

/** "Online Lecture 1" -> { kind: 'lecture', number: 1 }. */
function sessionOf(name) {
  const text = String(name).trim();
  const kind = SESSION_KINDS.find((k) => new RegExp(`\\b${k}\\b`, 'i').test(text)) || 'lecture';
  const number = text.match(/(\d{1,2})\s*$/);
  return { name: text, kind, number: number ? Number(number[1]) : null };
}

function indexType(dirName) {
  const hit = TYPES[String(dirName).trim().toLowerCase()];
  return hit || slugify(dirName);
}

function describeFile(full, name, folder) {
  let size = 0;
  try { size = fs.statSync(full).size; } catch { /* unreadable entry still gets listed */ }
  return { name, ext: extOf(name), size, folder };
}

function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`Source folder not found: ${SOURCE}`);
    process.exitCode = 1;
    return;
  }

  const subjects = [];
  for (const entry of readDirSafe(SOURCE)) {
    if (!entry.isDirectory()) continue;
    const subjectDir = path.join(SOURCE, entry.name);
    const weeks = [];

    for (const weekEntry of readDirSafe(subjectDir)) {
      const number = weekOf(weekEntry.name);
      if (!weekEntry.isDirectory() || number === null) continue;
      const sessions = [];

      for (const sessionEntry of readDirSafe(path.join(subjectDir, weekEntry.name))) {
        if (!sessionEntry.isDirectory()) continue;
        const dir = path.join(subjectDir, weekEntry.name, sessionEntry.name);
        const folders = [];
        const files = [];

        for (const item of readDirSafe(dir)) {
          const full = path.join(dir, item.name);
          if (item.isFile()) {
            files.push(describeFile(full, item.name, ''));
            continue;
          }
          if (!item.isDirectory()) continue;
          const inner = readDirSafe(full)
            .filter((f) => f.isFile())
            .map((f) => describeFile(path.join(full, f.name), f.name, item.name))
            .sort((a, b) => a.name.localeCompare(b.name));
          folders.push({ type: indexType(item.name), folder: item.name, files: inner });
        }
        if (!folders.length && !files.length) continue;

        const count = files.length + folders.reduce((s, f) => s + f.files.length, 0);
        sessions.push({
          ...sessionOf(sessionEntry.name),
          slug: slugify(sessionEntry.name),
          folders,
          files,
          fileCount: count,
          bytes: files.reduce((s, f) => s + f.size, 0) +
            folders.reduce((s, f) => s + f.files.reduce((t, x) => t + x.size, 0), 0),
        });
      }
      if (sessions.length) weeks.push({ week: number, name: weekEntry.name, sessions });
    }
    if (weeks.length) subjects.push({ name: entry.name, slug: slugify(entry.name), weeks });
  }

  subjects.sort((a, b) => a.name.localeCompare(b.name));
  const sum = (pick) => subjects.reduce(
    (s, x) => s + x.weeks.reduce((t, w) => t + w.sessions.reduce((u, e) => u + pick(e), 0), 0), 0);
  const totals = {
    subjects: subjects.length,
    weeks: subjects.reduce((s, x) => s + x.weeks.length, 0),
    sessions: sum(() => 1),
    files: sum((e) => e.fileCount),
    bytes: sum((e) => e.bytes),
  };

  console.log(`Source     : ${SOURCE}`);
  console.log(`Subjects   : ${totals.subjects}`);
  console.log(`Weeks      : ${totals.weeks}`);
  console.log(`Sessions   : ${totals.sessions}`);
  console.log(`Files      : ${totals.files}`);
  console.log(`Total size : ${(totals.bytes / (1024 * 1024)).toFixed(1)} MB (indexed, not copied)`);

  if (CHECK_ONLY) {
    console.log('\ncheck only - nothing written');
    return;
  }

  const document = {
    generatedAt: new Date().toISOString(),
    source: SOURCE,
    note: 'Index only - no files were copied. Name, size and type are read from the source folder.',
    totals,
    subjects,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  console.log(`\nWritten    : ${OUT}`);
}

main();