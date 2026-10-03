'use strict';
/** Public (guest) read-only endpoints. No session is required and no PII is exposed. */
const express = require('express');
const { asyncHandler, ApiError } = require('../lib/errors');
const { store } = require('../db/store');
const config = require('../config/env');

const router = express.Router();

/**
 * Teaching-material index built by scripts/import-material-library.js. It is a list of folder
 * names, file names and sizes - no account data - so guests may read it. The JSON file itself is
 * never served as a static asset; it is only ever read through this endpoint.
 */
const LIBRARY_FILE = require('path').join(__dirname, '..', '..', 'data_base', 'material-library.json');

/**
 * Every file the index knows about, keyed by its path relative to the library root
 * (Subject/Week n/Session/Type/name). Only these paths may ever be served, so a request can
 * never walk out of the library with `..` or name a file the index never listed.
 */
function libraryEntries() {
  const fs = require('fs');
  let document;
  try {
    document = JSON.parse(fs.readFileSync(LIBRARY_FILE, 'utf8'));
  } catch {
    return null;
  }
  const root = String(document.source || '');
  if (!root) return null;

  const allowed = new Map();
  const add = (prefix, files) => {
    for (const file of files || []) allowed.set(`${prefix}${file.name}`, { root, name: file.name });
  };
  for (const subject of document.subjects || []) {
    for (const week of subject.weeks || []) {
      for (const session of week.sessions || []) {
        const base = `${subject.name}/${week.name}/${session.name}/`;
        add(base, session.files);
        for (const folder of session.folders || []) add(`${base}${folder.folder}/`, folder.files);
      }
    }
  }
  return { root, allowed };
}

/**
 * Streams one library file. `?inline=1` opens it in the browser, otherwise it downloads.
 */
router.get(
  '/material-library/file',
  asyncHandler(async (req, res) => {
    const library = libraryEntries();
    if (!library) throw ApiError.notFound('The material library is not available.');

    const wanted = String(req.query.path || '').replace(/\\/g, '/').replace(/^\/+/, '');
    const entry = library.allowed.get(wanted);
    /* Membership in the index is the only authorisation: an unlisted path is refused, which
       also makes directory traversal impossible. */
    if (!entry) throw ApiError.notFound('That file is not in the material library.');

    const path = require('path');
    /* `wanted` is an exact key of the allow-list, so it cannot contain `..`; the resolved-path
       check below is a second, independent guard. */
    const full = path.join(library.root, wanted.split('/').join(path.sep));
    const relative = path.relative(path.resolve(library.root), path.resolve(full));
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw ApiError.notFound('That file is not in the material library.');
    }
    res.type(path.extname(full) || 'application/octet-stream');
    if (req.query.inline === '1') return res.sendFile(full);
    return res.download(full, entry.name);
  })
);

router.get(
  '/material-library',
  asyncHandler(async (req, res) => {
    let document;
    try {
      document = JSON.parse(await require('fs').promises.readFile(LIBRARY_FILE, 'utf8'));
    } catch {
      // No index yet is a normal state, not an error the guest needs to see.
      return res.json({ available: false, source: null, totals: null, subjects: [] });
    }
    res.json({
      available: true,
      generatedAt: document.generatedAt,
      source: document.source,
      note: document.note,
      totals: document.totals,
      subjects: document.subjects,
    });
  })
);

/** Site information safe for guests. */
router.get(
  '/site',
  asyncHandler(async (req, res) => {
    const info = await store.getInfo();
    res.json({
      title: info.title || 'بوابة المجموعات',
      tagline: info.tagline || 'إدارة بسيطة للحسابات والمجموعات',
      about: info.about || '',
      notice: info.notice || '',
      academicYear: info.academicYear || '',
      updatedAt: info.updatedAt || null,
      emailDomain: config.security.emailDomain,
    });
  })
);

/** Group names only. Membership lists and user data require a session. */
router.get(
  '/groups',
  asyncHandler(async (req, res) => {
    const groups = await store.listGroups();
    res.json({ groups: groups.map((group) => ({ name: group.name, description: group.description || '' })) });
  })
);

/**
 * "Permitted assessment information": only records an admin explicitly published.
 * Drafts and private group content never appear here.
 */
router.get(
  '/assessments',
  asyncHandler(async (req, res) => {
    const records = await store.listRecords({ publishedOnly: true });
    res.json({
      assessments: records.map((record) => ({
        title: record.title,
        group: record.group,
        kind: record.kind || '',
        dueDate: record.dueDate || '',
        summary: record.summary || '',
        publishedAt: record.updatedAt || record.createdAt || null,
      })),
    });
  })
);

module.exports = router;
