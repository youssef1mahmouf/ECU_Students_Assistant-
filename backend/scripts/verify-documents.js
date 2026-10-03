'use strict';
/**
 * Document storage verification (`npm run verify:documents`).
 *
 * Boots the real app against a throwaway file store and a throwaway storage root, then
 * proves the parts that matter: who may upload, what the byte-level type check refuses,
 * where a file physically lands, who may download it, and that deleting removes both the
 * row and the bytes. Nothing here touches backend/data_base or backend/storage.
 */
const os = require('os');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

process.env.DATA_STORE = 'file';
process.env.DATA_DIR = path.join(os.tmpdir(), `ga6-docs-${crypto.randomBytes(6).toString('hex')}`);
process.env.UPLOAD_DIR = path.join(os.tmpdir(), `ga6-storage-${crypto.randomBytes(6).toString('hex')}`);
process.env.UPLOAD_MAX_MB = '1';
process.env.NODE_ENV = 'development';
process.env.SESSION_SECRET = crypto.randomBytes(48).toString('base64url');

const config = require('../src/config/env');
const { createApp } = require('../src/app');
const { store, init, close } = require('../src/db/store');
const { hashPassword } = require('../src/lib/password');
const documents = require('../src/services/documents');

const PASSWORD = 'Portal#Pass1';
let passed = 0;
const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL  ${name}${detail ? ` -> ${detail}` : ''}`);
  }
}

/* ------------------------------------------------------------------ fixtures */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64');
const GIF = Buffer.concat([Buffer.from('GIF89a', 'latin1'), Buffer.alloc(24, 1)]);
const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n', 'latin1'), Buffer.alloc(64, 0x20)]);
const HTML_TRAP = Buffer.from('<html><script>alert(1)</script></html>', 'utf8');
const EXE_TRAP = Buffer.concat([Buffer.from('MZ\u0090\u0000', 'latin1'), Buffer.alloc(64, 0x0e)]);
const SVG_TRAP = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>', 'utf8');

function makeJar() {
  const jar = new Map();
  return {
    header: () => [...jar].map(([k, v]) => `${k}=${v}`).join('; '),
    absorb: (res) => {
      for (const raw of res.headers.getSetCookie ? res.headers.getSetCookie() : []) {
        const [pair] = raw.split(';');
        const index = pair.indexOf('=');
        if (index < 0) continue;
        const name = pair.slice(0, index).trim();
        const value = pair.slice(index + 1).trim();
        if (value === '' || /Expires=Thu, 01 Jan 1970/i.test(raw)) jar.delete(name);
        else jar.set(name, value);
      }
    },
    get: (name) => jar.get(name),
  };
}

let baseUrl = '';

async function open(urlPath, { jar, method = 'GET', body, csrf, raw = false } = {}) {
  const headers = {};
  if (jar && jar.header()) headers.cookie = jar.header();
  if (csrf) headers['x-csrf-token'] = csrf;
  let payload;
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const response = await fetch(baseUrl + urlPath, { method, headers, body: payload });
  if (jar) jar.absorb(response);
  if (raw) return { status: response.status, headers: response.headers, buffer: Buffer.from(await response.arrayBuffer()) };
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not json */
  }
  return { status: response.status, text, json };
}

async function signIn(email) {
  const jar = makeJar();
  await open('/api/auth/me', { jar });
  const result = await open('/api/auth/login', {
    jar,
    method: 'POST',
    csrf: jar.get('ga6_csrf_v2'),
    body: { email, password: PASSWORD },
  });
  return { jar, csrf: jar.get('ga6_csrf_v2'), status: result.status };
}

const upload = (jar, csrf, payload) =>
  open('/api/admin/documents', { jar, method: 'POST', csrf, body: payload });

const b64 = (buffer) => buffer.toString('base64');

async function seed() {
  await init();
  await store.createGroup({ name: 'GA-6', description: '', createdBy: 'verify' });
  await store.createGroup({ name: 'GA-1', description: '', createdBy: 'verify' });
  /* A third group with its own member: used to prove a multi-group document never leaks
     into a group that was not selected. */
  await store.createGroup({ name: 'GA-2', description: '', createdBy: 'verify' });
  await store.createSubject({
    slug: 'assessments',
    code: 'ASM',
    nameEn: 'Assessments',
    nameAr: 'التقييمات',
    description: '',
    active: true,
    createdBy: 'verify',
  });
  /* Sign-in checks the allow-list, so the test students need roster rows - exactly like the
     real students imported from the PDFs. These are synthetic identities in a temp folder. */
  await store.importRoster([
    { email: 'six@ecu.edu.eg', name: 'Member Six', studentId: '900000006', group: 'GA-6', type: 'student', academicYear: 'verify', advisorName: '', advisorEmail: '', source: 'verify-documents', page: 1 },
    { email: 'one@ecu.edu.eg', name: 'Member One', studentId: '900000001', group: 'GA-1', type: 'student', academicYear: 'verify', advisorName: '', advisorEmail: '', source: 'verify-documents', page: 1 },
    { email: 'pending@ecu.edu.eg', name: 'Pending', studentId: '900000009', group: 'GA-6', type: 'student', academicYear: 'verify', advisorName: '', advisorEmail: '', source: 'verify-documents', page: 1 },
    { email: 'two@ecu.edu.eg', name: 'Member Two', studentId: '900000002', group: 'GA-2', type: 'student', academicYear: 'verify', advisorName: '', advisorEmail: '', source: 'verify-documents', page: 1 },
  ]);
  const passwordHash = await hashPassword(PASSWORD);
  await store.createUser({ name: 'Owner', email: 'owner@ecu.edu.eg', passwordHash, role: 'superAdmin', group: '', confirmed: true, active: true, staffCreated: true });
  await store.createUser({ name: 'Member Six', email: 'six@ecu.edu.eg', passwordHash, role: 'user', group: 'GA-6', confirmed: true, active: true });
  await store.createUser({ name: 'Member One', email: 'one@ecu.edu.eg', passwordHash, role: 'user', group: 'GA-1', confirmed: true, active: true });
  await store.createUser({ name: 'Pending', email: 'pending@ecu.edu.eg', passwordHash, role: 'user', group: 'GA-6', confirmed: false, active: true });
  await store.createUser({ name: 'Member Two', email: 'two@ecu.edu.eg', passwordHash, role: 'user', group: 'GA-2', confirmed: true, active: true });
}

function storageRoot() {
  return path.resolve(config.upload.dir);
}

function filesUnder(root) {
  if (!fs.existsSync(root)) return [];
  const found = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) found.push(...filesUnder(full));
    else found.push(full);
  }
  return found;
}

async function run() {
  const owner = await signIn('owner@ecu.edu.eg');
  const six = await signIn('six@ecu.edu.eg');
  const one = await signIn('one@ecu.edu.eg');

  console.log('\n[1] Upload rules: roles, types, size, CSRF');
  check('staff signs in', owner.status === 200, `status ${owner.status}`);
  check('student signs in', six.status === 200, `status ${six.status}`);

  const pngUpload = await upload(owner.jar, owner.csrf, {
    group: 'GA-6',
    subject: 'assessments',
    displayName: '',
    published: false,
    fileName: 'sheet.png',
    fileBase64: b64(PNG),
  });
  check('a valid PNG is accepted for a real group', pngUpload.status === 201, `status ${pngUpload.status} ${pngUpload.text}`);
  const png = pngUpload.json?.document || {};
  check('the answer carries metadata only, never a storage key', png.id && !pngUpload.text.includes('storageKey') && !pngUpload.text.includes('checksum'), pngUpload.text.slice(0, 120));
  check('the file lands under <group>/<subject>/', fs.existsSync(path.join(storageRoot(), 'ga-6', 'assessments')), storageRoot());
  const storedFiles = filesUnder(storageRoot());
  check('the stored file name is generated, not the client name', storedFiles.length === 1 && !storedFiles[0].endsWith('sheet.png'), storedFiles.join(','));
  check('the stored bytes match the upload', storedFiles.length === 1 && Buffer.compare(fs.readFileSync(storedFiles[0]), PNG) === 0);

  const pdfUpload = await upload(owner.jar, owner.csrf, {
    group: 'GA-6', subject: 'assessments', fileName: 'book.pdf', published: true, fileBase64: b64(PDF),
  });
  check('a valid PDF is accepted', pdfUpload.status === 201, `status ${pdfUpload.status}`);
  const gifUpload = await upload(owner.jar, owner.csrf, {
    group: 'GA-1', subject: 'assessments', fileName: 'logo.gif', published: true, fileBase64: b64(GIF),
  });
  check('a GIF in another group is accepted (staff scope)', gifUpload.status === 201, `status ${gifUpload.status}`);

  check('an executable is refused', (await upload(owner.jar, owner.csrf, { group: 'GA-6', subject: 'assessments', fileName: 'tool.exe', fileBase64: b64(EXE_TRAP) })).status === 400);
  check('an HTML body wearing a .png name is refused', (await upload(owner.jar, owner.csrf, { group: 'GA-6', subject: 'assessments', fileName: 'page.png', fileBase64: b64(HTML_TRAP) })).status === 400);
  check('a PNG named .pdf is refused (content/extension mismatch)', (await upload(owner.jar, owner.csrf, { group: 'GA-6', subject: 'assessments', fileName: 'real.pdf', fileBase64: b64(PNG) })).status === 400);
  check('an SVG is refused', (await upload(owner.jar, owner.csrf, { group: 'GA-6', subject: 'assessments', fileName: 'icon.svg', fileBase64: b64(SVG_TRAP) })).status === 400);
  check('a zero-byte upload is refused', (await upload(owner.jar, owner.csrf, { group: 'GA-6', subject: 'assessments', fileName: 'x.png', fileBase64: '' })).status === 400);

  const oversized = await upload(owner.jar, owner.csrf, {
    group: 'GA-6', subject: 'assessments', fileName: 'big.png', fileBase64: b64(Buffer.concat([PNG, Buffer.alloc(1024 * 1024 + 64, 7)])),
  });
  check(`an oversized file is refused (limit ${Math.round(config.upload.maxBytes / (1024 * 1024))} MB)`, oversized.status === 400 || oversized.status === 413, `status ${oversized.status}`);

  const studentUpload = await upload(six.jar, six.csrf, { group: 'GA-6', subject: 'assessments', fileName: 'sneak.png', fileBase64: b64(PNG) });
  check('a student cannot upload', studentUpload.status === 403, `status ${studentUpload.status}`);
  const anonymousUpload = await open('/api/admin/documents', { method: 'POST', body: { group: 'GA-6', subject: 'assessments', fileName: 'a.png', fileBase64: b64(PNG) } });
  check('an anonymous upload is refused before any handler runs', anonymousUpload.status === 401 || anonymousUpload.status === 403, `status ${anonymousUpload.status}`);
  const noCsrf = await open('/api/admin/documents', { jar: owner.jar, method: 'POST', body: { group: 'GA-6', subject: 'assessments', fileName: 'a.png', fileBase64: b64(PNG) } });
  check('an upload without the CSRF header is blocked', noCsrf.status === 403, `status ${noCsrf.status}`);

  check('an unknown group is refused', (await upload(owner.jar, owner.csrf, { group: 'ZZ-9', subject: 'assessments', fileName: 'a.png', fileBase64: b64(PNG) })).status === 400);
  check('an unknown subject is refused', (await upload(owner.jar, owner.csrf, { group: 'GA-6', subject: 'ghost-subject', fileName: 'a.png', fileBase64: b64(PNG) })).status === 400);
  const traversal = await upload(owner.jar, owner.csrf, { group: '../../etc', subject: '../subjects', fileName: 'a.png', fileBase64: b64(PNG) });
  check('a traversal attempt in group/subject is refused', traversal.status === 400, `status ${traversal.status}`);
  check('nothing was written outside the two expected folders', filesUnder(storageRoot()).length === 3, String(filesUnder(storageRoot()).length));

  console.log('\n[2] Read and download authorisation');
  const sixList = await open('/api/documents', { jar: six.jar });
  const sixDocs = sixList.json?.documents || [];
  check('a student lists only their own group', sixList.status === 200 && sixDocs.length > 0 && sixDocs.every((doc) => doc.group === 'GA-6'), JSON.stringify(sixDocs.map((doc) => doc.group)));
  check('drafts stay invisible to a student', sixDocs.every((doc) => doc.published === true), JSON.stringify(sixDocs.map((doc) => [doc.displayName, doc.published])));
  check('a document of another group is never listed', !sixDocs.some((doc) => doc.group === 'GA-1'));

  const pdfId = pdfUpload.json.document.id;
  const gifId = gifUpload.json.document.id;
  const ownDownload = await open(`/api/documents/${pdfId}/file`, { jar: six.jar, raw: true });
  check('a student downloads a published document of their group', ownDownload.status === 200 && Buffer.compare(ownDownload.buffer, PDF) === 0, `status ${ownDownload.status}`);
  check('the download is always an attachment', /attachment;/.test(ownDownload.headers.get('content-disposition') || ''), ownDownload.headers.get('content-disposition'));
  check('the download cannot be sniffed as a page', ownDownload.headers.get('x-content-type-options') === 'nosniff');
  check('the download carries a sandboxed CSP', /sandbox/.test(ownDownload.headers.get('content-security-policy') || ''), ownDownload.headers.get('content-security-policy'));
  check('the download is never cached', /no-store/.test(ownDownload.headers.get('cache-control') || ''));

  const crossGroup = await open(`/api/documents/${gifId}/file`, { jar: six.jar });
  check('another group document answers 404, not 403 (no existence leak)', crossGroup.status === 404, `status ${crossGroup.status}`);
  const staffDownload = await open(`/api/documents/${gifId}/file`, { jar: owner.jar, raw: true });
  check('staff may download any group document', staffDownload.status === 200 && Buffer.compare(staffDownload.buffer, GIF) === 0, `status ${staffDownload.status}`);
  check('a guest cannot download', (await open(`/api/documents/${pdfId}/file`)).status === 401);

  const draftFile = await open(`/api/documents/${png.id}/file`, { jar: six.jar });
  check('an unpublished document cannot be opened by a student', draftFile.status === 404, `status ${draftFile.status}`);
  const publish = await open(`/api/admin/documents/${png.id}`, { jar: owner.jar, method: 'PATCH', csrf: owner.csrf, body: { published: true } });
  check('staff can publish it', publish.status === 200 && publish.json.document.published === true, `status ${publish.status}`);
  check('after publishing the student can open it', (await open(`/api/documents/${png.id}/file`, { jar: six.jar })).status === 200);
  const unpublish = await open(`/api/admin/documents/${png.id}`, { jar: owner.jar, method: 'PATCH', csrf: owner.csrf, body: { published: false } });
  check('staff can un-publish it again', unpublish.status === 200 && unpublish.json.document.published === false);
  const pending = await signIn('pending@ecu.edu.eg');
  check('an unconfirmed student lists nothing', ((await open('/api/documents', { jar: pending.jar })).json?.documents || []).length === 0);

  /* -------------------------------------------------- multi-group documents */
  console.log('\n[2b] A document can be assigned to more than one group');
  // GA-6 + GA-2 are used here so the GA-1 folder the lifecycle checks empty later stays untouched.
  const sharedUpload = await upload(owner.jar, owner.csrf, {
    groups: ['GA-6', 'GA-2'], subject: 'assessments', fileName: 'shared.pdf', published: true, fileBase64: b64(PDF),
  });
  check('an upload with a group list is accepted', sharedUpload.status === 201, `status ${sharedUpload.status} ${sharedUpload.text}`);
  const shared = sharedUpload.json?.document || {};
  check('the record carries every selected group',
    (shared.groups || []).join(',') === 'GA-6,GA-2', JSON.stringify(shared.groups));
  check('the bytes are stored once, under the primary group',
    fs.existsSync(path.join(storageRoot(), 'ga-6', 'assessments')));
  const sharedId = shared.id;
  check('the primary group can open it', (await open(`/api/documents/${sharedId}/file`, { jar: six.jar })).status === 200);
  const two = await signIn('two@ecu.edu.eg');
  check('the second selected group can open it', (await open(`/api/documents/${sharedId}/file`, { jar: two.jar })).status === 200);
  check('the second selected group also lists it',
    ((await open('/api/documents', { jar: two.jar })).json?.documents || []).some((doc) => doc.id === sharedId));
  const oneShared = await open(`/api/documents/${sharedId}/file`, { jar: one.jar });
  check('a group that was not selected gets 404, never the bytes', oneShared.status === 404, `status ${oneShared.status}`);
  const oneList = await open('/api/documents', { jar: one.jar });
  check('a group that was not selected never lists it',
    !(oneList.json?.documents || []).some((doc) => doc.id === sharedId));
  const unlistedUpload = await upload(owner.jar, owner.csrf, {
    groups: ['GA-6', 'ZZ-9'], subject: 'assessments', fileName: 'bad.pdf', fileBase64: b64(PDF),
  });
  check('one unknown group in the list refuses the whole upload', unlistedUpload.status === 400, `status ${unlistedUpload.status}`);
  const emptyGroups = await upload(owner.jar, owner.csrf, {
    groups: [], subject: 'assessments', fileName: 'none.pdf', fileBase64: b64(PDF),
  });
  check('an empty group list is refused', emptyGroups.status === 400, `status ${emptyGroups.status}`);

  console.log('\n[3] Storage isolation and lifecycle');
  check('the storage folder is not reachable as static content', (await open('/storage/ga-6/assessments/x.png')).status === 404);
  check('the backend path is not reachable either', (await open('/backend/storage/ga-6/assessments/x.png')).status === 404);

  const renamed = await open(`/api/admin/documents/${png.id}`, {
    jar: owner.jar, method: 'PATCH', csrf: owner.csrf, body: { displayName: '../../etc/passwd quote.png' },
  });
  check('a display name is sanitised before it reaches a header', renamed.status === 200 && !renamed.json.document.displayName.includes('/'), renamed.json?.document?.displayName);
  check('a too-short display name is refused', (await open(`/api/admin/documents/${png.id}`, { jar: owner.jar, method: 'PATCH', csrf: owner.csrf, body: { displayName: '.' } })).status === 400);

  const studentDelete = await open(`/api/admin/documents/${png.id}`, { jar: six.jar, method: 'DELETE', csrf: six.csrf });
  check('a student cannot delete a document', studentDelete.status === 403, `status ${studentDelete.status}`);
  const before = filesUnder(storageRoot()).length;
  const removed = await open(`/api/admin/documents/${png.id}`, { jar: owner.jar, method: 'DELETE', csrf: owner.csrf });
  check('staff deletes the metadata row', removed.status === 200, `status ${removed.status}`);
  check('deleting also removes the bytes', filesUnder(storageRoot()).length === before - 1, `${before} -> ${filesUnder(storageRoot()).length}`);
  check('the deleted document no longer downloads', (await open(`/api/documents/${png.id}/file`, { jar: six.jar })).status === 404);

  const subjectList = await open('/api/admin/subjects', { jar: owner.jar });
  const subjectId = (subjectList.json?.subjects || []).find((subject) => subject.slug === 'assessments')?.id;
  check('the subject list counts the documents inside it', (subjectList.json?.subjects || []).some((subject) => subject.documentCount > 0));
  check('a subject that still holds documents is not deleted', (await open(`/api/admin/subjects/${subjectId}`, { jar: owner.jar, method: 'DELETE', csrf: owner.csrf })).status === 409);
  const groupList = await open('/api/admin/groups', { jar: owner.jar });
  const otherGroupId = (groupList.json?.groups || []).find((group) => group.name === 'GA-1')?.id;
  check('a group that still holds documents is not deleted', (await open(`/api/admin/groups/${otherGroupId}`, { jar: owner.jar, method: 'DELETE', csrf: owner.csrf })).status === 409);
  const removedOther = await open(`/api/admin/documents/${gifId}`, { jar: owner.jar, method: 'DELETE', csrf: owner.csrf });
  check('the last document of that group is deleted', removedOther.status === 200, `status ${removedOther.status}`);
  check('the group is deletable once its folder is empty', (await open(`/api/admin/groups/${otherGroupId}`, { jar: owner.jar, method: 'DELETE', csrf: owner.csrf })).status === 200);
  check('a subject with a hostile slug is refused', (await open('/api/admin/subjects', { jar: owner.jar, method: 'POST', csrf: owner.csrf, body: { slug: '../escape', nameEn: 'Escape', nameAr: 'خروج' } })).status === 400);
  const createdSubject = await open('/api/admin/subjects', { jar: owner.jar, method: 'POST', csrf: owner.csrf, body: { nameEn: 'Extra Notes', nameAr: 'ملاحظات', code: 'EXT' } });
  check('a subject is created from its English name when no slug is given', createdSubject.status === 201 && createdSubject.json.subject.slug === 'extra-notes', JSON.stringify(createdSubject.json?.subject || {}));
  check('a duplicate subject slug is refused', (await open('/api/admin/subjects', { jar: owner.jar, method: 'POST', csrf: owner.csrf, body: { slug: 'extra-notes', nameEn: 'Extra Notes', nameAr: 'ملاحظات' } })).status === 409);

  check('a key that escapes the storage root is refused by the service', (() => {
    try {
      documents.resolveInsideStorage('../../windows/win.ini');
      return false;
    } catch (error) {
      return error.status === 403;
    }
  })());
  check('slugifying collapses a hostile label into one folder', documents.safeSegment('../../Windows/../..') === 'windows');
}

async function main() {
  await seed();
  const app = createApp();
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    await run();
  } finally {
    server.close();
    await close();
    fs.rmSync(config.dataDir, { recursive: true, force: true });
    fs.rmSync(config.upload.dir, { recursive: true, force: true });
  }

  console.log(`\n${passed} document checks passed, ${failures.length} failed.`);
  if (failures.length) {
    console.log('Failed checks:');
    for (const failure of failures) console.log(`  - ${failure}`);
    process.exitCode = 1;
  } else {
    console.log('Upload, storage and download authorisation behave as specified.');
  }
}

main().catch((error) => {
  console.error('Document verification crashed:', error);
  process.exitCode = 1;
});



