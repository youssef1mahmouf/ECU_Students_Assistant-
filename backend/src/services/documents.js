'use strict';
/**
 * Document storage service.
 *
 * Rules enforced here (the routes only translate them into HTTP answers):
 *  - the file name a browser sends is never used as a path: the stored key is always
 *    `<safe-group>/<safe-subject>/<generated-uuid>.<extension>` under config.upload.dir;
 *  - group and subject come from records the server already has, then pass through a
 *    slugifier, so `../`, absolute paths and odd characters cannot reach the filesystem;
 *  - only the allow-list below is accepted, and the *bytes* decide the type: the declared
 *    extension must agree with the file signature;
 *  - the decoded size is capped by config.upload.maxBytes;
 *  - every read resolves the key and verifies that it stays inside the storage root.
 *
 * No virus scanning happens anywhere in this project: files are stored, never executed,
 * and are always served as attachments with nosniff plus a sandboxed CSP.
 */
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const config = require('../config/env');
const { ApiError } = require('../lib/errors');
const { hasCap } = require('../lib/permissions');
const { groupsOf } = require('../lib/groups');

/* extension -> MIME. Everything omitted here is refused, including svg/html/zip/js which
   would be a scripting or download risk if they ever reached a browser. */
const ALLOWED = [
  { ext: 'pdf', mime: 'application/pdf', extensions: ['pdf'] },
  { ext: 'png', mime: 'image/png', extensions: ['png'] },
  { ext: 'jpg', mime: 'image/jpeg', extensions: ['jpg', 'jpeg', 'jpe'] },
  { ext: 'webp', mime: 'image/webp', extensions: ['webp'] },
  { ext: 'gif', mime: 'image/gif', extensions: ['gif'] },
  { ext: 'doc', mime: 'application/msword', extensions: ['doc'] },
  { ext: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', extensions: ['docx'] },
  { ext: 'mp4', mime: 'video/mp4', extensions: ['mp4', 'm4v'] },
  { ext: 'mov', mime: 'video/quicktime', extensions: ['mov'] },
  { ext: 'webm', mime: 'video/webm', extensions: ['webm'] },
  { ext: 'mp3', mime: 'audio/mpeg', extensions: ['mp3'] },
  { ext: 'm4a', mime: 'audio/mp4', extensions: ['m4a'] },
  { ext: 'wav', mime: 'audio/wav', extensions: ['wav'] },
  { ext: 'ogg', mime: 'audio/ogg', extensions: ['ogg', 'oga'] },
];

const TOO_LARGE = () =>
  ApiError.badRequest(`The file is larger than ${Math.round(config.upload.maxBytes / (1024 * 1024))} MB.`);
const TYPE_REFUSED =
  'This file type is not allowed. Upload PDF, Word, video (MP4, MOV, WebM) or audio (MP3, M4A, WAV, OGG).';

const hex = (buffer, count) => buffer.subarray(0, count).toString('hex');

/** Identify the real content type from the leading bytes; null when nothing matches. */
function detectType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  if (hex(buffer, 5) === Buffer.from('%PDF-', 'latin1').toString('hex')) return ALLOWED[0];
  if (hex(buffer, 8) === '89504e470d0a1a0a') return ALLOWED[1];
  if (hex(buffer, 3) === 'ffd8ff') return ALLOWED[2];
  if (hex(buffer, 4) === '52494646' && buffer.subarray(8, 12).toString('latin1') === 'WEBP') return ALLOWED[3];
  const gif = buffer.subarray(0, 6).toString('latin1');
  if (gif === 'GIF87a' || gif === 'GIF89a') return ALLOWED[4];
  if (hex(buffer, 8) === 'd0cf11e0a1b11ae1') return ALLOWED.find((item) => item.ext === 'doc');
  if (hex(buffer, 4) === '504b0304') return ALLOWED.find((item) => item.ext === 'docx');
  if (buffer.subarray(4, 8).toString('latin1') === 'ftyp') {
    const brand = buffer.subarray(8, 12).toString('latin1');
    return brand === 'qt  ' ? ALLOWED.find((item) => item.ext === 'mov') : ALLOWED.find((item) => item.ext === 'mp4');
  }
  if (hex(buffer, 4) === '1a45dfa3') return ALLOWED.find((item) => item.ext === 'webm');
  if (buffer.subarray(0, 4).toString('latin1') === 'RIFF') {
    if (buffer.subarray(8, 12).toString('latin1') === 'WAVE') return ALLOWED.find((item) => item.ext === 'wav');
    if (buffer.subarray(8, 12).toString('latin1') === 'WEBP') return ALLOWED[3];
  }
  if (buffer.subarray(0, 4).toString('latin1') === 'OggS') return ALLOWED.find((item) => item.ext === 'ogg');
  if (buffer.subarray(0, 3).toString('latin1') === 'ID3'
    || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)) return ALLOWED.find((item) => item.ext === 'mp3');
  return null;
}

const MIME_BY_TYPE = new Map(ALLOWED.map((entry) => [entry.ext, entry.mime]));
const EXTENSION_ALIASES = new Map(
  ALLOWED.flatMap((entry) => entry.extensions.map((alias) => [alias, entry.ext]))
);

/** One path segment from a stored group/subject label. Never from a client-supplied path. */
function safeSegment(raw, fallback = 'unsorted') {
  const text = String(raw ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '');
  // A segment must never be empty, '.' or '..': the slugifier collapses all of those.
  if (!text || text === '.' || text === '..' || !/^[a-z0-9][a-z0-9.-]*$/.test(text)) return fallback;
  return text;
}

/** Slug used by the subjects API; keeps the ASCII shape that storage paths need. */
function slugify(raw, fallback) {
  return safeSegment(raw, fallback);
}

/** A file name shown to people: never a path, never control characters, never quotes. */
function safeDisplayName(value, fallback = 'document') {
  const base = String(value ?? '').split(/[\\/]/).pop() || '';
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[<>|"'`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.\s]+/, '')
    .slice(0, 120);
  return cleaned || fallback;
}

/** A whole number inside a range. Used for week / session numbers that become folder names. */
function positiveInt(value, min, max, field = 'Number') {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw ApiError.badRequest(`${field} must be a whole number between ${min} and ${max}.`);
  }
  return parsed;
}

/** Resolve a stored key and prove that it stays inside the storage root. */
function resolveInsideStorage(storageKey) {
  const root = path.resolve(config.upload.dir);
  const target = path.resolve(root, String(storageKey || ''));
  const relativePath = path.relative(root, target);
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw ApiError.forbidden('This document path is not allowed.');
  }
  return target;
}

/**
 * Validate an upload payload ({ fileName, fileBase64 }) and return the decoded buffer plus
 * the type the *content* proved. Throws ApiError on anything suspicious.
 */
function decodeUpload({ fileName, fileBase64 } = {}) {
  if (typeof fileBase64 !== 'string' || fileBase64.trim() === '') {
    throw ApiError.badRequest('Choose a file to upload.');
  }
  const compact = fileBase64.replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(compact)) {
    throw ApiError.badRequest('The uploaded data is not a valid file.');
  }
  if (Math.floor((compact.length * 3) / 4) > config.upload.maxBytes) throw TOO_LARGE();
  const buffer = Buffer.from(compact, 'base64');
  if (buffer.length === 0) throw ApiError.badRequest('The uploaded file is empty.');
  if (buffer.length > config.upload.maxBytes) throw TOO_LARGE();

  const detected = detectType(buffer);
  if (!detected) throw ApiError.badRequest(TYPE_REFUSED);

  const declaredExtension = path.extname(String(fileName || '')).toLowerCase().replace(/^\./, '');
  if (declaredExtension) {
    const mapped = EXTENSION_ALIASES.get(declaredExtension);
    if (!mapped) throw ApiError.badRequest(TYPE_REFUSED);
    if (mapped !== detected.ext) {
      throw ApiError.badRequest('The file content does not match its extension, so it was rejected.');
    }
  }

  return {
    buffer,
    ext: detected.ext,
    mime: MIME_BY_TYPE.get(detected.ext),
    size: buffer.length,
    checksum: crypto.createHash('sha256').update(buffer).digest('hex'),
    displayName: safeDisplayName(fileName, `document.${detected.ext}`),
  };
}

/**
 * Build the storage key from server-owned values only.
 *
 * The path mirrors how the material is taught, so the folders on disk can be browsed and
 * understood without the database:
 *
 *   <subject>/week-<n>/<session-kind>-<n>/<name>.<ext>      e.g. physics/week-3/lab-2/pdf.pdf
 *
 * The file name is derived from the *kind* of content rather than from whatever the browser
 * sent, which is what makes an upload repeatable: uploading again for the same
 * subject/week/session/kind lands on the same path and replaces the bytes instead of piling
 * up near-duplicates. Groups are not part of the path on purpose - one document can be
 * associated with several groups, and the group list lives on the record.
 */
const SESSION_KINDS = ['lecture', 'tutorial', 'lab'];

/**
 * Content folder used inside the session folder. The type is a FOLDER and the uploaded file
 * keeps its own name, so the tree on disk reads the way the faculty arranged it by hand:
 *
 *   Mathematics / Week 1 / Lecture 2 / PDF / Function sheet.pdf
 *
 * The previous layout used the type as the file name (`lecture-2/pdf.pdf`), which threw the
 * real name away and made every folder hold exactly one file.
 */
const TYPE_FOLDERS = {
  pdf: 'PDF',
  word: 'Word',
  image: 'Imge',
  video: 'V',
  recording: 'RE',
};

/* Raw extensions are accepted too, because the caller may hold the upload's extension rather
   than the type detectType() derived from it. */
const EXT_FOLDERS = {
  pdf: 'PDF',
  doc: 'Word',
  docx: 'Word',
  png: 'Imge',
  jpg: 'Imge',
  jpeg: 'Imge',
  gif: 'Imge',
  webp: 'Imge',
  mp4: 'V',
  mov: 'V',
  webm: 'V',
  mp3: 'RE',
  m4a: 'RE',
  wav: 'RE',
  ogg: 'RE',
};

/** Folder name for a stored type or file extension. */
function storageFolder(typeOrExt) {
  const key = String(typeOrExt || '').toLowerCase();
  return TYPE_FOLDERS[key] || EXT_FOLDERS[key] || 'Other';
}

/** Kept under the old name because callers and scripts already import it. */
function storageStem(ext) {
  return storageFolder(ext);
}

/**
 * A file name that keeps the person's own words but cannot escape its folder. Separators,
 * drive letters, dots and control characters are removed; the extension is preserved.
 */
function safeFileName(raw, ext) {
  const fallback = `file.${ext}`;
  const text = String(raw ?? '').normalize('NFC');
  const base = text.split(/[\\/]/).pop() || '';
  const cleaned = base
    /* Reserved for Windows plus control characters. Written as a list so no stray dash can
       turn into an unintended character range. */
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/^[.\s]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned || cleaned === '.' || cleaned === '..') return fallback;
  const hasExt = ext && cleaned.toLowerCase().endsWith(`.${ext}`);
  return hasExt ? cleaned.slice(0, 200) : `${cleaned.slice(0, 190)}.${ext}`;
}

/**
 * The slot a document occupies. The file name is part of the slot, so uploading a second,
 * differently named file adds to the same folder instead of replacing the first one, while
 * re-uploading the same name deliberately replaces it.
 */
function documentSlot({ subject, week, sessionKind, sessionNumber, ext, filename } = {}) {
  return [subject, week, sessionKind, sessionNumber, storageFolder(ext), filename].join('|');
}

function buildStorageKey({ subject, week, sessionKind, sessionNumber, ext, filename } = {}) {
  const subjectSegment = safeSegment(subject);
  const weekSegment = `Week ${safeSegment(week, '1')}`;
  const kindSegment = safeSegment(SESSION_KINDS.includes(sessionKind) ? sessionKind : 'lecture');
  const numberSegment = `${kindSegment}-${safeSegment(sessionNumber, '1')}`;
  return `${subjectSegment}/${weekSegment}/${numberSegment}/${storageFolder(ext)}/${safeFileName(filename, ext)}`;
}

/**
 * Write the bytes for a slot. A re-upload of the same subject/week/session/kind is a
 * deliberate replacement, so the previous file is overwritten rather than refused; the
 * caller updates the record in the same step so the row and the bytes never disagree.
 */
async function writeDocumentFile(storageKey, buffer) {
  const target = resolveInsideStorage(storageKey);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, buffer);
  return target;
}

async function removeDocumentFile(storageKey) {
  if (!storageKey) return false;
  try {
    await fs.unlink(resolveInsideStorage(storageKey));
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function readDocumentFile(storageKey) {
  return fs.readFile(resolveInsideStorage(storageKey));
}

async function documentFileExists(storageKey) {
  try {
    await fs.access(resolveInsideStorage(storageKey));
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ access */

function isStaff(user) {
  return Boolean(user) && hasCap(user.role, 'documentsView');
}

/** Only roles with documentsManage may upload, edit, unpublish or delete. */
function canManageDocuments(user) {
  return Boolean(user) && hasCap(user.role, 'documentsManage');
}

/**
 * Who may open a document: staff roles (any group), and a student only once their group
 * membership is approved, the document is published, and the stored group list on the
 * document contains the group from *their* account. The requested group is never taken
 * from the request, so a student cannot reach another group by editing a URL - the same
 * rule the group content already follows.
 */
function canReadDocument(user, document) {
  if (!user || user.active === false) return false;
  if (isStaff(user)) return true;
  if (!user.confirmed) return false;
  if (!document.published) return false;
  const ownGroup = String(user.group || '');
  if (!ownGroup) return false;
  return groupsOf(document).includes(ownGroup);
}

/** What a browser may see: the key on disk and the checksum stay server-side. */
function clientView(document) {
  const groups = groupsOf(document);
  return {
    id: document.id,
    displayName: document.displayName,
    mimeType: document.mimeType,
    size: document.size,
    group: document.group || groups[0] || '',
    groups,
    subject: document.subject,
    subjectName: document.subjectName || '',
    published: Boolean(document.published),
    uploaderName: document.uploaderName || '',
    createdAt: document.createdAt || null,
    updatedAt: document.updatedAt || null,
    url: `/api/documents/${encodeURIComponent(document.id)}/file`,
    packageId: document.packageId || '',
    packageTitle: document.packageTitle || '',
    weekNumber: document.weekNumber || null,
    lectureNumber: document.lectureNumber || null,
    sessionKind: document.sessionKind || 'lecture',
    // The folder the file really sits in, so the admin list mirrors the folders on disk.
    folderPath: String(document.storageKey || '').split('/').slice(0, -1).join('/'),
  };
}

/** Response headers for a download: never rendered, never sniffed, never cached. */
function downloadHeaders(document) {
  const asciiName =
    String(document.displayName || '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9 ._-]/g, '_')
      .slice(0, 100) || `document-${document.id}`;
  const utf8Name = encodeURIComponent(document.displayName || asciiName);
  return {
    'Content-Type': MIME_BY_TYPE.get(document.extension) || document.mimeType || 'application/octet-stream',
    'Content-Disposition': `${String(document.mimeType || '').startsWith('video/') || String(document.mimeType || '').startsWith('audio/') ? 'inline' : 'attachment'}; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`,
    'Content-Length': String(document.size),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Resource-Policy': 'same-origin',
    // Defence in depth: even if a browser tried to render the bytes, the sandbox blocks it.
    'Content-Security-Policy': "default-src 'none'; sandbox",
  };
}

module.exports = {
  ALLOWED,
  SESSION_KINDS,
  storageStem,
  storageFolder,
  safeFileName,
  documentSlot,
  positiveInt,
  detectType,
  safeSegment,
  slugify,
  safeDisplayName,
  resolveInsideStorage,
  decodeUpload,
  buildStorageKey,
  writeDocumentFile,
  removeDocumentFile,
  readDocumentFile,
  documentFileExists,
  isStaff,
  canManageDocuments,
  canReadDocument,
  clientView,
  downloadHeaders,
};


