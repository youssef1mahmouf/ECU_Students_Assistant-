'use strict';
/**
 * Document routes.
 *
 * `readerRouter` (/api/documents) is for every signed-in account: a student sees only the
 * published documents of the group stored on their own account, staff see every group.
 * `managerRouter` (/api/admin/documents) is staff-only and owns upload, rename, publish and
 * delete. Neither route accepts a filesystem path from a client.
 */
const crypto = require('crypto');
const express = require('express');

const config = require('../config/env');
const { store } = require('../db/store');
const v = require('../lib/validate');
const { ApiError, asyncHandler } = require('../lib/errors');
const { requireAuth, requireAdmin, requireCap } = require('../middleware/auth');
const { rateLimit } = require('../middleware/security');
const documents = require('../services/documents');
const { logActivity } = require('../services/activity');

const uploadLimiter = rateLimit({ windowMs: config.security.rateLimitWindowMs, max: 60, prefix: 'upload' });

async function loadSubjects() {
  const subjects = await store.listSubjects();
  return new Map(subjects.map((subject) => [subject.slug, subject]));
}

/**
 * Validates the group assignment of an upload: a `groups` list (multi-select) or a single
 * legacy `group`. Every name must be an existing group; the result is de-duplicated.
 */
async function resolveUploadGroups({ groups, group }) {
  let names = [];
  if (Array.isArray(groups)) names = groups.map((name) => (typeof name === 'string' ? name.trim() : ''));
  else if (typeof groups === 'string' && groups.trim()) names = [groups];
  else if (typeof group === 'string' && group.trim()) names = [group];
  names = [...new Set(names.filter(Boolean))];
  if (!names.length) throw ApiError.badRequest('Group is required.');
  if (names.length > 25) throw ApiError.badRequest('Group accepts at most 25 groups.');
  const out = [];
  for (const name of names) {
    const safe = v.groupName(name, { field: 'Group' });
    if (!(await store.findGroupByName(safe))) throw ApiError.badRequest('The selected group is not available.');
    if (!out.includes(safe)) out.push(safe);
  }
  return out;
}

/** Attach the subject label and drop server-only fields (storage key, checksum). */
function withSubjectName(document, subjectsById) {
  const subject = subjectsById.get(document.subject);
  return documents.clientView({ ...document, subjectName: subject ? subject.nameEn : '' });
}

function subjectOptions(subjects) {
  return subjects
    .filter((subject) => subject.active !== false)
    .map((subject) => ({ slug: subject.slug, code: subject.code || '', nameEn: subject.nameEn, nameAr: subject.nameAr }));
}

/* ------------------------------------------------------------ read (any role) */
const readerRouter = express.Router();
readerRouter.use(requireAuth);

readerRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = {};
    // Only staff may ask for another group; a student is always scoped to their own record.
    if (documents.isStaff(req.user)) {
      if (req.query.group) filter.group = v.groupName(req.query.group, { field: 'Group' });
    } else {
      filter.group = req.user.group || '__none__';
      filter.publishedOnly = true;
    }
    if (req.query.subject) filter.subject = v.subjectSlug(req.query.subject);

    const [rows, subjects] = await Promise.all([store.listDocuments(filter), store.listSubjects()]);
    const subjectsById = new Map(subjects.map((subject) => [subject.slug, subject]));
    res.json({
      group: req.user.group || '',
      isStaff: documents.isStaff(req.user),
      canManage: documents.canManageDocuments(req.user),
      subjects: subjectOptions(subjects),
      documents: rows
        .filter((document) => documents.canReadDocument(req.user, document))
        .map((document) => withSubjectName(document, subjectsById)),
    });
  })
);

/**
 * The file itself. Access is decided from the stored account and the stored document, never
 * from a path, and the answer is 404 for "does not exist" and "not yours" alike so the route
 * cannot be used to discover what another group holds.
 */
readerRouter.get(
  '/:id/file',
  asyncHandler(async (req, res) => {
    const document = await store.findDocumentById(v.id(req.params.id, { field: 'Document id' }));
    if (!document || !documents.canReadDocument(req.user, document)) {
      throw ApiError.notFound('Document not found.');
    }
    const buffer = await documents.readDocumentFile(document.storageKey).catch(() => null);
    if (!buffer) throw ApiError.notFound('The stored file is no longer available on this server.');

    for (const [name, value] of Object.entries(documents.downloadHeaders(document))) {
      res.setHeader(name, value);
    }
    res.status(200).send(buffer);
  })
);

/* ------------------------------------------------------- manage (staff only) */
const managerRouter = express.Router();
managerRouter.use(requireAdmin);

managerRouter.get(
  '/',
  requireCap('documentsView'),
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.group) filter.group = v.groupName(req.query.group, { field: 'Group' });
    if (req.query.subject) filter.subject = v.subjectSlug(req.query.subject);
    const subjectsById = await loadSubjects();
    const rows = await store.listDocuments(filter);
    res.json({
      documents: rows.map((document) => withSubjectName(document, subjectsById)),
      subjects: subjectOptions([...subjectsById.values()]),
      limitMb: Math.round(config.upload.maxBytes / (1024 * 1024)),
    });
  })
);

/**
 * Upload. The file arrives base64-encoded inside JSON (a multipart parser would add a
 * dependency without adding safety here); the decoded bytes decide the type, and the storage
 * key is built from validated, already-known group and subject values.
 *
 * `groups` accepts a list (the multi-select UI); a single `group` is still honoured so
 * older clients keep working. The file is stored once under the primary group's folder and
 * the record is associated with every selected group.
 */
managerRouter.post(
  '/',
  requireCap('documentsManage'),
  uploadLimiter,
  asyncHandler(async (req, res) => {
    const body = v.pick(req.body, ['group', 'groups', 'subject', 'displayName', 'published', 'fileName', 'fileBase64', 'weekNumber', 'sessionKind', 'lectureNumber']);
    const groups = await resolveUploadGroups(body);
    const group = groups[0];
    const slug = v.subjectSlug(body.subject);
    const subject = await store.findSubjectBySlug(slug);
    if (!subject) throw ApiError.badRequest('The selected subject is not available.');
    if (subject.active === false) throw ApiError.badRequest('This subject is archived; pick an active one.');

    /* Where the file belongs: subject -> week -> lecture/tutorial/lab. These three decide
       the folder, so they are read from the request but validated and slugified like any
       other path input before they can reach the filesystem. */
    const weekNumber = documents.positiveInt(body.weekNumber, 1, 60, 'Week');
    const sessionKind = documents.SESSION_KINDS.includes(body.sessionKind) ? body.sessionKind : 'lecture';
    const sessionNumber = documents.positiveInt(body.lectureNumber, 1, 30, 'Session');

    const upload = documents.decodeUpload({ fileName: body.fileName, fileBase64: body.fileBase64 });
    const displayName = body.displayName === undefined
      ? upload.displayName
      : documents.safeDisplayName(body.displayName, upload.displayName);

    const storageKey = documents.buildStorageKey({
      subject: subject.slug,
      week: weekNumber,
      sessionKind,
      sessionNumber,
      ext: upload.ext,
      /* The file keeps its own name inside the type folder, so the tree reads like the
         library on disk and a second, differently named upload joins the same folder
         instead of overwriting the first one. */
      filename: upload.fileName,
    });

    /* Re-uploading the same name into the same subject/week/session/type folder is a
       deliberate replacement: the old row is replaced and the bytes are overwritten. A
       different file name is a new document, so the folder accumulates. */
    const existing = (await store.listDocuments({ subject: subject.slug }))
      .find((row) => row.storageKey === storageKey);

    await documents.writeDocumentFile(storageKey, upload.buffer);

    const patch = {
      group,
      groups,
      subject: subject.slug,
      displayName,
      mimeType: upload.mime,
      extension: upload.ext,
      size: upload.size,
      checksum: upload.checksum,
      storageKey,
      weekNumber,
      sessionKind,
      lectureNumber: sessionNumber,
      published: v.boolean(body.published, false),
      uploaderId: req.user.id,
      uploaderName: req.user.name,
    };

    let document;
    try {
      document = existing
        ? await store.updateDocument(existing.id, patch)
        : await store.createDocument(patch);
    } catch (error) {
      // Metadata failed: leave no orphan file behind.
      await documents.removeDocumentFile(storageKey);
      throw error;
    }

    await logActivity({
      actor: req.user.name,
      action: `${existing ? 'Replaced' : 'Uploaded'} "${displayName}" at ${storageKey} for ${groups.join(', ')}.`,
      level: 'admin',
      page: '/admin/documents/',
      actorRole: req.user.role,
    });
    const subjectsById = await loadSubjects();
    res.status(existing ? 200 : 201).json({ document: withSubjectName(document, subjectsById), replaced: Boolean(existing) });
  })
);

/** Only the label and the published flag may change; a file never moves between folders. */
managerRouter.patch(
  '/:id',
  requireCap('documentsManage'),
  asyncHandler(async (req, res) => {
    const document = await store.findDocumentById(v.id(req.params.id, { field: 'Document id' }));
    if (!document) throw ApiError.notFound('Document not found.');
    const body = v.pick(req.body, ['displayName', 'published']);
    const patch = {};
    if (body.displayName !== undefined) {
      const nextName = documents.safeDisplayName(body.displayName, '');
      if (nextName.length < 2) throw ApiError.badRequest('Display name is too short.');
      patch.displayName = nextName;
    }
    if (body.published !== undefined) patch.published = v.boolean(body.published);
    const updated = await store.updateDocument(document.id, patch);
    await logActivity({ actor: req.user.name, action: `Updated document "${document.displayName}".`, level: 'admin', page: '/admin/documents/' });
    const subjectsById = await loadSubjects();
    res.json({ document: withSubjectName(updated, subjectsById) });
  })
);

/** Delete the metadata and the bytes together. */
managerRouter.delete(
  '/:id',
  requireCap('documentsManage'),
  asyncHandler(async (req, res) => {
    const document = await store.findDocumentById(v.id(req.params.id, { field: 'Document id' }));
    if (!document) throw ApiError.notFound('Document not found.');
    await store.deleteDocument(document.id);
    await documents.removeDocumentFile(document.storageKey);
    await logActivity({ actor: req.user.name, action: `Deleted document "${document.displayName}".`, level: 'admin', page: '/admin/documents/' });
    res.json({ message: 'Document deleted.' });
  })
);

module.exports = { readerRouter, managerRouter };

