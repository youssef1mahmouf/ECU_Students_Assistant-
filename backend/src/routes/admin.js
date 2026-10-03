'use strict';
/**
 * Admin API. The whole router sits behind requireAdmin (see app.js); individual routes add
 * requireSuperAdmin where the action is privileged. Guards below also protect the last
 * super admin and stop ordinary admins from editing privileged accounts.
 */
const express = require('express');
const { store } = require('../db/store');
const v = require('../lib/validate');
const { ApiError, asyncHandler } = require('../lib/errors');
const { requireAdmin, requireSuperAdmin, requireCap } = require('../middleware/auth');
const { ROLES, PRIVILEGED_ROLES, hasCap } = require('../lib/permissions');
const { staffView, isProtectedOwner } = require('../lib/dto');
const { groupsOf, inGroups } = require('../lib/groups');
const { hashPassword } = require('../lib/password');
const { revokeUserSessions } = require('../lib/session');
const { logActivity } = require('../services/activity');
const documentsService = require('../services/documents');
const config = require('../config/env');

const router = express.Router();
router.use(requireAdmin);

async function isLastSuperAdmin(userId) {
  const users = await store.listUsers();
  const supers = users.filter((user) => user.role === 'superAdmin' && user.active !== false);
  return supers.length <= 1 && supers.some((user) => user.id === userId);
}

/**
 * Loads a target account and enforces the privilege rule: an ordinary admin may manage
 * student accounts only, never staff accounts. The actor always comes from the session.
 */
async function loadTarget(id, actor) {
  const safeId = v.id(id, { field: 'Account id' });
  const target = await store.findUserById(safeId);
  if (!target) throw ApiError.notFound('Account not found.');
  if (target.role !== 'user' && actor !== 'superAdmin') {
    throw ApiError.forbidden('Only a super admin can manage staff accounts.');
  }
  return target;
}

/** Blocked actions on the primary owner account - enforced here, whatever the browser sent. */
function assertNotProtectedOwner(target, action) {
  if (isProtectedOwner(target)) {
    throw ApiError.forbidden(`The protected owner account cannot be ${action} through the admin API.`);
  }
}

/**
 * Validates an incoming group list (or a legacy single `group`). Every name must exist;
 * the result is de-duplicated and capped. Empty is only allowed when the caller allows it.
 */
async function resolveGroupList({ groups, group }, { field = 'Group', allowEmpty = false } = {}) {
  let names = [];
  if (Array.isArray(groups)) names = groups.map((name) => (typeof name === 'string' ? name.trim() : ''));
  else if (typeof groups === 'string' && groups.trim()) names = [groups];
  else if (typeof group === 'string' && group.trim()) names = [group];
  names = [...new Set(names.filter(Boolean))];
  if (!names.length) {
    if (allowEmpty) return [];
    throw ApiError.badRequest(`${field} is required.`);
  }
  if (names.length > 25) throw ApiError.badRequest(`${field} accepts at most 25 groups.`);
  const validated = [];
  for (const name of names) {
    const safe = v.groupName(name, { field });
    if (!(await store.findGroupByName(safe))) throw ApiError.badRequest('The selected group is not available.');
    if (!validated.includes(safe)) validated.push(safe);
  }
  return validated;
}

/** Validates subject slugs against the stored catalogue (used by group edit). */
async function resolveSubjectSlugs(list) {
  if (list === undefined || list === null) return undefined;
  if (!Array.isArray(list)) throw ApiError.badRequest('Subjects must be a list.');
  if (list.length > 50) throw ApiError.badRequest('A group accepts at most 50 subjects.');
  const out = [];
  for (const raw of list) {
    const slug = v.subjectSlug(raw, { field: 'Subject' });
    const subject = await store.findSubjectBySlug(slug);
    if (!subject) throw ApiError.badRequest('The selected subject is not available.');
    if (!out.includes(slug)) out.push(slug);
  }
  return out;
}

/* ---------------------------------------------------------------- overview */
/**
 * Dashboard numbers, all derived from persisted data:
 *  - users: total accounts; byRole: one count per role (admins = admin + superAdmin);
 *  - online: distinct accounts with a session seen inside the configurable window
 *    (ONLINE_WINDOW_MINUTES, default 15; session lastSeenAt is touched each minute);
 *  - charts: activity entries bucketed per calendar day (last 14), per ISO week
 *    (last 8, Mon-Sun) and per calendar month (last 12), counted from `createdAt`
 *    in server local time. `recentActivity` was removed: detailed review lives in
 *    Admin - Activity Log.
 */
router.get(
  '/overview',
  requireCap('dashboard'),
  asyncHandler(async (req, res) => {
    const [users, groups, records, activity, sessions] = await Promise.all([
      store.listUsers(),
      store.listGroups(),
      store.listRecords(),
      store.listActivity({ limit: 5000 }),
      store.findRecentSessions(new Date(Date.now() - config.dashboard.onlineWindowMinutes * 60_000).toISOString()),
    ]);

    const byRole = {};
    for (const role of ROLES) byRole[role] = 0;
    for (const user of users) byRole[user.role] = (byRole[user.role] || 0) + 1;

    const onlineUserIds = new Set(sessions.map((session) => session.userId));

    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const dailyBuckets = [];
    for (let offset = 13; offset >= 0; offset -= 1) {
      const start = new Date(startOfDay.getTime() - offset * dayMs);
      const end = new Date(start.getTime() + dayMs);
      dailyBuckets.push({ from: start.toISOString(), to: end.toISOString(), label: ymd(start), count: 0 });
    }
    // ISO week starting Monday.
    const weekday = (startOfDay.getDay() + 6) % 7;
    const startOfWeek = new Date(startOfDay.getTime() - weekday * dayMs);
    const weeklyBuckets = [];
    for (let offset = 7; offset >= 0; offset -= 1) {
      const start = new Date(startOfWeek.getTime() - offset * 7 * dayMs);
      const end = new Date(start.getTime() + 7 * dayMs);
      weeklyBuckets.push({ from: start.toISOString(), to: end.toISOString(), label: ymd(start), count: 0 });
    }
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyBuckets = [];
    for (let offset = 11; offset >= 0; offset -= 1) {
      const start = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() - offset, 1);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
      monthlyBuckets.push({ from: start.toISOString(), to: end.toISOString(), label: ymd(start), count: 0 });
    }

    for (const entry of activity) {
      const at = new Date(entry.createdAt).getTime();
      if (Number.isNaN(at)) continue;
      bucketInto(dailyBuckets, at);
      bucketInto(weeklyBuckets, at);
      bucketInto(monthlyBuckets, at);
    }

    res.json({
      stats: {
        users: users.length,
        byRole,
        admins: (byRole.admin || 0) + (byRole.superAdmin || 0),
        pending: users.filter((user) => !user.confirmed && user.role === 'user').length,
        groups: groups.length,
        records: records.length,
        online: {
          count: onlineUserIds.size,
          windowMinutes: config.dashboard.onlineWindowMinutes,
          asOf: now.toISOString(),
        },
      },
      charts: {
        // Each bucket carries its own inclusive-from / exclusive-to range plus the count.
        daily: { bucket: 'day', buckets: dailyBuckets },
        weekly: { bucket: 'week', buckets: weeklyBuckets },
        monthly: { bucket: 'month', buckets: monthlyBuckets },
      },
    });
  })
);

function ymd(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function bucketInto(buckets, time) {
  const first = buckets[0];
  const last = buckets[buckets.length - 1];
  if (time < new Date(first.from).getTime() || time >= new Date(last.to).getTime()) return;
  for (const bucket of buckets) {
    if (time >= new Date(bucket.from).getTime() && time < new Date(bucket.to).getTime()) {
      bucket.count += 1;
      return;
    }
  }
}

/* ------------------------------------------------------------------ groups */
router.get(
  '/groups',
  requireCap('groupsView'),
  asyncHandler(async (req, res) => {
    const [groups, users, records, subjects] = await Promise.all([
      store.listGroups(),
      store.listUsers(),
      store.listRecords(),
      store.listSubjects(),
    ]);
    const subjectsBySlug = new Map(subjects.map((subject) => [subject.slug, subject]));
    res.json({
      groups: groups.map((group) => ({
        ...group,
        notes: typeof group.notes === 'string' ? group.notes : '',
        subjects: Array.isArray(group.subjects) ? group.subjects : [],
        // Labels for the card, resolved server-side; the slug stays the stored identity.
        subjectLabels: (Array.isArray(group.subjects) ? group.subjects : []).map((slug) => {
          const subject = subjectsBySlug.get(slug);
          return { slug, nameEn: subject ? subject.nameEn : slug, nameAr: subject ? subject.nameAr : slug };
        }),
        memberCount: users.filter((user) => user.group === group.name).length,
        recordCount: records.filter((record) => inGroups(record, group.name)).length,
      })),
      subjects: subjects.map((subject) => ({ slug: subject.slug, nameEn: subject.nameEn, nameAr: subject.nameAr })),
    });
  })
);

router.post(
  '/groups',
  requireCap('groupsManage'),
  asyncHandler(async (req, res) => {
    const body = v.pick(req.body, ['name', 'description', 'notes', 'subjects']);
    const name = v.groupName(body.name);
    const description = v.str(body.description, { field: 'Description', max: 300, optional: true });
    const notes = v.str(body.notes, { field: 'Notes', max: 2000, optional: true });
    const subjects = await resolveSubjectSlugs(body.subjects);
    if (await store.findGroupByName(name)) throw ApiError.conflict('A group with this name already exists.');
    const group = await store.createGroup({
      name,
      description,
      notes,
      subjects: subjects || [],
      createdBy: req.user.name,
    });
    await logActivity({ actor: req.user.name, action: `Created group "${name}".`, level: 'admin', page: '/admin/groups/' });
    res.status(201).json({ group });
  })
);

/** Edit: name, description, notes and subject associations can all change here. */
router.patch(
  '/groups/:id',
  requireCap('groupsManage'),
  asyncHandler(async (req, res) => {
    const existing = await store.findGroupById(v.id(req.params.id, { field: 'Group id' }));
    if (!existing) throw ApiError.notFound('Group not found.');
    const body = v.pick(req.body, ['name', 'description', 'notes', 'subjects']);
    const patch = {};
    if (body.name !== undefined) patch.name = v.groupName(body.name);
    if (body.description !== undefined) patch.description = v.str(body.description, { field: 'Description', max: 300, optional: true });
    if (body.notes !== undefined) patch.notes = v.str(body.notes, { field: 'Notes', max: 2000, optional: true });
    const subjects = await resolveSubjectSlugs(body.subjects);
    if (subjects !== undefined) patch.subjects = subjects;
    if (patch.name && patch.name !== existing.name && (await store.findGroupByName(patch.name))) {
      throw ApiError.conflict('A group with this name already exists.');
    }
    const group = await store.updateGroup(existing.id, patch);
    // Keep member accounts, content and documents pointing at the renamed group.
    if (patch.name && patch.name !== existing.name) {
      for (const user of await store.listUsers()) {
        if (user.group === existing.name) await store.updateUser(user.id, { group: patch.name, confirmed: user.confirmed });
      }
      for (const record of await store.listRecords({ group: existing.name })) {
        await store.updateRecord(record.id, {
          group: record.group === existing.name ? patch.name : record.group,
          groups: groupsOf(record).map((name) => (name === existing.name ? patch.name : name)),
        });
      }
      for (const document of await store.listDocuments({ group: existing.name })) {
        await store.updateDocument(document.id, {
          group: document.group === existing.name ? patch.name : document.group,
          groups: groupsOf(document).map((name) => (name === existing.name ? patch.name : name)),
        });
      }
    }
    await logActivity({ actor: req.user.name, action: `Updated group "${existing.name}".`, level: 'admin', page: '/admin/groups/' });
    res.json({ group });
  })
);

router.delete(
  '/groups/:id',
  requireCap('groupsManage'),
  asyncHandler(async (req, res) => {
    const group = await store.findGroupById(v.id(req.params.id, { field: 'Group id' }));
    if (!group) throw ApiError.notFound('Group not found.');
    // A group is the first half of a storage path that may still hold files, so it cannot be
    // dropped while documents point at it - that would strand bytes on disk with no record.
    const held = await store.listDocuments({ group: group.name });
    if (held.length > 0) {
      throw ApiError.conflict(`This group still holds ${held.length} document(s). Delete them first.`);
    }
    await store.deleteGroup(group.id);
    await logActivity({ actor: req.user.name, action: `Deleted group "${group.name}".`, level: 'admin', page: '/admin/groups/' });
    res.json({ message: 'Group deleted.', name: group.name });
  })
);

/* ---------------------------------------------------------------- accounts */
router.get(
  '/users',
  requireCap('accountsView'),
  asyncHandler(async (req, res) => {
    const users = await store.listUsers();
    res.json({ users: users.map(staffView) });
  })
);

/** Staff-created account. The role comes from the route, not from an unprivileged default. */
router.post(
  '/users',
  requireCap('accountsManage'),
  asyncHandler(async (req, res) => {
    const body = v.pick(req.body, ['name', 'email', 'password', 'group', 'role']);
    const name = v.str(body.name, { field: 'Name', min: 3, max: 80 });
    const email = v.email(body.email);
    const secret = v.password(body.password);
    const requestedRole = v.oneOf(body.role || 'user', ROLES, { field: 'Role' });
    if (await store.findUserByEmail(email)) throw ApiError.conflict('An account already uses this email address.');
    if (PRIVILEGED_ROLES.includes(requestedRole) && req.user.role !== 'superAdmin') {
      throw ApiError.forbidden('Only a super admin can create or assign privileged roles.');
    }
    const group = requestedRole === 'user' ? v.groupName(body.group, { field: 'Group' }) : '';
    if (group && !(await store.findGroupByName(group))) throw ApiError.badRequest('The selected group is not available.');
    // Identity fields for a rostered address come from the roster, not from the form;
    // staffCreated records that an administrator authorised this account by hand.
    const entry = await store.findRosterByEmail(email);
    const user = await store.createUser({
      name,
      email,
      passwordHash: await hashPassword(secret),
      role: requestedRole,
      group,
      studentId: entry ? entry.studentId || '' : '',
      advisorName: entry ? entry.advisorName || '' : '',
      advisorEmail: entry ? entry.advisorEmail || '' : '',
      academicYear: entry ? entry.academicYear || '' : '',
      isTeachingAssistant: entry ? entry.type === 'ta' : false,
      taGroups: entry && Array.isArray(entry.taGroups) ? entry.taGroups : [],
      staffCreated: true,
      confirmed: true, // created by staff, so membership is approved by definition
      active: true,
    });
    await logActivity({ actor: req.user.name, action: `Created ${requestedRole} account for ${name}.`, level: 'admin' });
    res.status(201).json({ user: staffView(user) });
  })
);

/** Approve / disable / re-group an account. Role changes are super-admin only. */
router.patch(
  '/users/:id',
  requireCap('accountsManage'),
  asyncHandler(async (req, res) => {
    const target = await loadTarget(req.params.id, req.user.role);
    const body = v.pick(req.body, ['confirmed', 'active', 'group', 'name', 'role']);
    const patch = {};
    if (body.name !== undefined) patch.name = v.str(body.name, { field: 'Name', min: 3, max: 80 });
    if (body.confirmed !== undefined) patch.confirmed = v.boolean(body.confirmed);
    if (body.active !== undefined) patch.active = v.boolean(body.active);
    if (body.group !== undefined) {
      patch.group = v.groupName(body.group, { field: 'Group' });
      if (!(await store.findGroupByName(patch.group))) throw ApiError.badRequest('The selected group is not available.');
    }
    if (body.role !== undefined) {
      if (req.user.role !== 'superAdmin') throw ApiError.forbidden('Only a super admin can change roles.');
      patch.role = v.oneOf(body.role, ROLES, { field: 'Role' });
      if (patch.role !== 'superAdmin' && (await isLastSuperAdmin(target.id))) {
        throw ApiError.badRequest('At least one active super admin must remain.');
      }
    }
    if (patch.active === false && (await isLastSuperAdmin(target.id))) {
      throw ApiError.badRequest('At least one active super admin must remain.');
    }
    if (target.id === req.user.id && (patch.active === false || (patch.role && patch.role !== req.user.role))) {
      throw ApiError.badRequest('You cannot disable or demote your own account.');
    }
    // The protected owner account: no disable, no demotion, no group move through this API.
    if (patch.active === false) assertNotProtectedOwner(target, 'disabled');
    if (patch.role !== undefined && patch.role !== target.role) assertNotProtectedOwner(target, 're-roled');
    if (patch.group !== undefined && isProtectedOwner(target)) {
      throw ApiError.forbidden('The protected owner account cannot be moved between groups through the admin API.');
    }
    const user = await store.updateUser(target.id, patch);
    // Losing access must also end the target's existing sessions.
    if (patch.active === false || patch.role || patch.group) await store.deleteSessionsForUser(target.id);
    await logActivity({ actor: req.user.name, action: `Updated account "${target.name}".`, level: 'admin', page: '/admin/accounts/' });
    res.json({ user: staffView(user) });
  })
);

/** Staff reset a password: the new value is set, and every session for that user ends. */
router.post(
  '/users/:id/password',
  requireCap('accountsManage'),
  asyncHandler(async (req, res) => {
    const target = await loadTarget(req.params.id, req.user.role);
    assertNotProtectedOwner(target, 'password-reset');
    const secret = v.password(v.pick(req.body, ['password']).password);
    await store.updateUser(target.id, { passwordHash: await hashPassword(secret) });
    await store.deleteSessionsForUser(target.id);
    await logActivity({
      actor: req.user.name,
      action: `Reset the password for "${target.name}".`,
      level: 'security',
      page: '/admin/accounts/',
    });
    res.json({ message: 'Password reset. The account was signed out everywhere.' });
  })
);

router.delete(
  '/users/:id',
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const target = await loadTarget(req.params.id, req.user.role);
    assertNotProtectedOwner(target, 'deleted');
    if (target.id === req.user.id) throw ApiError.badRequest('You cannot delete your own account.');
    if (await isLastSuperAdmin(target.id)) throw ApiError.badRequest('At least one active super admin must remain.');
    await store.deleteUser(target.id);
    await logActivity({ actor: req.user.name, action: `Deleted account "${target.name}".`, level: 'security', page: '/admin/accounts/' });
    res.json({ message: 'Account deleted.' });
  })
);

/* ----------------------------------------------------------------- records */
router.get(
  '/records',
  requireCap('contentView'),
  asyncHandler(async (req, res) => {
    const group = req.query.group ? v.groupName(req.query.group, { field: 'Group' }) : undefined;
    res.json({ records: await store.listRecords(group ? { group } : {}) });
  })
);

router.post(
  '/records',
  requireCap('contentManage'),
  asyncHandler(async (req, res) => {
    const body = v.pick(req.body, ['group', 'groups', 'title', 'kind', 'dueDate', 'summary', 'body', 'published']);
    // Multi-group: `groups` is the modern field, a single `group` is still accepted
    // (older clients and imported records keep working).
    const groups = await resolveGroupList(body, { field: 'Group' });
    const record = await store.createRecord({
      groups,
      group: groups[0], // primary value kept for legacy readers and old indexes
      title: v.str(body.title, { field: 'Title', min: 3, max: 140 }),
      kind: v.contentKind(body.kind),
      dueDate: normaliseDate(body.dueDate),
      summary: v.str(body.summary, { field: 'Summary', max: 280, optional: true }),
      body: v.str(body.body, { field: 'Content', max: 4000, optional: true }),
      published: v.boolean(body.published),
      createdBy: req.user.name,
    });
    await logActivity({
      actor: req.user.name,
      action: `Added content "${record.title}" to ${groups.join(', ')}.`,
      level: 'admin',
      page: '/admin/groups/',
    });
    res.status(201).json({ record });
  })
);

router.patch(
  '/records/:id',
  requireCap('contentManage'),
  asyncHandler(async (req, res) => {
    const existing = await store.findRecordById(v.id(req.params.id, { field: 'Record id' }));
    if (!existing) throw ApiError.notFound('Content not found.');
    const body = v.pick(req.body, ['group', 'groups', 'title', 'kind', 'dueDate', 'summary', 'body', 'published']);
    const patch = {};
    if (body.groups !== undefined || body.group !== undefined) {
      patch.groups = await resolveGroupList(body, { field: 'Group' });
      patch.group = patch.groups[0];
    }
    if (body.title !== undefined) patch.title = v.str(body.title, { field: 'Title', min: 3, max: 140 });
    if (body.kind !== undefined) patch.kind = v.contentKind(body.kind);
    if (body.dueDate !== undefined) patch.dueDate = normaliseDate(body.dueDate);
    if (body.summary !== undefined) patch.summary = v.str(body.summary, { field: 'Summary', max: 280, optional: true });
    if (body.body !== undefined) patch.body = v.str(body.body, { field: 'Content', max: 4000, optional: true });
    if (body.published !== undefined) patch.published = v.boolean(body.published);
    const record = await store.updateRecord(existing.id, patch);
    await logActivity({ actor: req.user.name, action: `Updated content "${existing.title}".`, level: 'admin', page: '/admin/groups/' });
    res.json({ record });
  })
);

router.delete(
  '/records/:id',
  requireCap('contentManage'),
  asyncHandler(async (req, res) => {
    const record = await store.findRecordById(v.id(req.params.id, { field: 'Record id' }));
    if (!record) throw ApiError.notFound('Content not found.');
    await store.deleteRecord(record.id);
    await logActivity({ actor: req.user.name, action: `Deleted content "${record.title}".`, level: 'admin', page: '/admin/groups/' });
    res.json({ message: 'Content deleted.' });
  })
);

/* ---------------------------------------------------------------- subjects */
/**
 * Subjects are the second half of a document's folder (`<group>/<subject>/`). The slug is
 * fixed at creation because it names a directory on disk: renaming a subject later changes
 * the labels only, never the storage path.
 */
router.get(
  '/subjects',
  requireCap('documentsView'),
  asyncHandler(async (req, res) => {
    const [subjects, documents] = await Promise.all([store.listSubjects(), store.listDocuments()]);
    res.json({
      subjects: subjects.map((subject) => ({
        ...subject,
        documentCount: documents.filter((document) => document.subject === subject.slug).length,
      })),
    });
  })
);

router.post(
  '/subjects',
  requireCap('subjectsManage'),
  asyncHandler(async (req, res) => {
    const body = v.pick(req.body, ['slug', 'code', 'nameEn', 'nameAr', 'description']);
    const nameEn = v.str(body.nameEn, { field: 'English name', min: 2, max: 120 });
    // The New Subject form only asks for the English name; the Arabic label falls back to
    // it so the bilingual display never shows an empty side. An explicit Arabic name is
    // still accepted (the catalogue and the Edit dialog may supply one).
    const nameAr = body.nameAr === undefined || body.nameAr === '' ? nameEn : v.str(body.nameAr, { field: 'Arabic name', min: 2, max: 120 });
    const code = v.str(body.code, { field: 'Code', max: 20, optional: true });
    const description = v.str(body.description, { field: 'Description', max: 300, optional: true });
    const slug = body.slug === undefined || body.slug === ''
      ? slugFromName(nameEn)
      : v.subjectSlug(body.slug);
    if (await store.findSubjectBySlug(slug)) throw ApiError.conflict('A subject with this reference already exists.');
    const subject = await store.createSubject({
      slug,
      code,
      nameEn,
      nameAr,
      description,
      active: true,
      createdBy: req.user.name,
    });
    await logActivity({ actor: req.user.name, action: `Created subject "${nameEn}".`, level: 'admin', page: '/admin/subjects/' });
    res.status(201).json({ subject });
  })
);

/** The slug is immutable on purpose: it is the name of a folder that already holds files. */
router.patch(
  '/subjects/:id',
  requireCap('subjectsManage'),
  asyncHandler(async (req, res) => {
    const existing = await store.findSubjectById(v.id(req.params.id, { field: 'Subject id' }));
    if (!existing) throw ApiError.notFound('Subject not found.');
    const body = v.pick(req.body, ['code', 'nameEn', 'nameAr', 'description', 'active']);
    const patch = {};
    if (body.nameEn !== undefined) patch.nameEn = v.str(body.nameEn, { field: 'English name', min: 2, max: 120 });
    if (body.nameAr !== undefined) patch.nameAr = v.str(body.nameAr, { field: 'Arabic name', min: 2, max: 120 });
    if (body.code !== undefined) patch.code = v.str(body.code, { field: 'Code', max: 20, optional: true });
    if (body.description !== undefined) {
      patch.description = v.str(body.description, { field: 'Description', max: 300, optional: true });
    }
    if (body.active !== undefined) patch.active = v.boolean(body.active);
    const subject = await store.updateSubject(existing.id, patch);
    await logActivity({ actor: req.user.name, action: `Updated subject "${existing.nameEn}".`, level: 'admin', page: '/admin/subjects/' });
    res.json({ subject });
  })
);

/** An archive keeps the folder and its files intact; only an empty subject can be removed. */
router.delete(
  '/subjects/:id',
  requireCap('subjectsManage'),
  asyncHandler(async (req, res) => {
    const subject = await store.findSubjectById(v.id(req.params.id, { field: 'Subject id' }));
    if (!subject) throw ApiError.notFound('Subject not found.');
    const used = (await store.listDocuments({ subject: subject.slug })).length;
    if (used > 0) {
      throw ApiError.conflict(`This subject still holds ${used} document(s). Move or delete them first.`);
    }
    await store.deleteSubject(subject.id);
    await logActivity({ actor: req.user.name, action: `Deleted subject "${subject.nameEn}".`, level: 'admin', page: '/admin/subjects/' });
    res.json({ message: 'Subject deleted.' });
  })
);

/** Slug helper shared with the seed script: ASCII, lowercase, folder-safe. */
function slugFromName(name) {
  return v.subjectSlug(documentsService.safeSegment(name, ''), { field: 'Subject' });
}

/* ---------------------------------------------------------------- activity */
/**
 * Recorded events with two optional filters:
 *  - `who=admin|user`  staff vs students (entries record the actor's role; older entries
 *    are classified through the account that still carries that name);
 *  - `actor=<name>`    one specific person (options come from the loaded rows/users).
 */
router.get(
  '/activity',
  requireCap('activityView'),
  asyncHandler(async (req, res) => {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 100, 1), 500);
    const who = req.query.who ? v.oneOf(String(req.query.who), ['admin', 'user'], { field: 'Who' }) : '';
    const actor = req.query.actor ? String(req.query.actor).slice(0, 120) : '';
    let rows = await store.listActivity({ limit: 500 });

    if (who) {
      const users = await store.listUsers();
      const kindOf = (entry) => {
        if (entry.actorRole) return hasCap(entry.actorRole, 'adminArea') ? 'admin' : 'user';
        const user = users.find((item) => item.name === entry.actor || item.email === entry.actor);
        if (!user) return 'system';
        return hasCap(user.role, 'adminArea') ? 'admin' : 'user';
      };
      rows = rows.filter((entry) => kindOf(entry) === who);
    }
    if (actor) rows = rows.filter((entry) => entry.actor === actor);

    const page = rows.slice(0, limit);
    const actors = [...new Set(rows.map((entry) => entry.actor).filter(Boolean))];
    res.json({ activity: page, actors });
  })
);

/* -------------------------------------------------------------------- info */
router.get(
  '/info',
  requireCap('reportsView'),
  asyncHandler(async (req, res) => {
    res.json({ info: await store.getInfo() });
  })
);

router.put(
  '/info',
  requireCap('reportsManage'),
  asyncHandler(async (req, res) => {
    const body = v.pick(req.body, ['title', 'tagline', 'about', 'notice', 'academicYear']);
    const patch = {};
    if (body.title !== undefined) patch.title = v.str(body.title, { field: 'Title', max: 120 });
    if (body.tagline !== undefined) patch.tagline = v.str(body.tagline, { field: 'Tagline', max: 160 });
    if (body.about !== undefined) patch.about = v.str(body.about, { field: 'About', max: 1200, optional: true });
    if (body.notice !== undefined) patch.notice = v.str(body.notice, { field: 'Notice', max: 400, optional: true });
    if (body.academicYear !== undefined) patch.academicYear = v.str(body.academicYear, { field: 'Academic year', max: 40, optional: true });
    const info = await store.saveInfo(patch);
    await logActivity({ actor: req.user.name, action: 'Updated site information.', level: 'admin', page: '/admin/information/' });
    res.json({ info });
  })
);

/* ------------------------------------------------------------ problem reports */
router.get(
  '/problems',
  requireCap('problemsView'),
  asyncHandler(async (req, res) => {
    res.json({ problems: await store.listProblems({ limit: 500 }) });
  })
);

/** Status changes only - the report text and the reporter are immutable history. */
router.patch(
  '/problems/:id',
  requireCap('problemsManage'),
  asyncHandler(async (req, res) => {
    const existing = await store.findProblemById(v.id(req.params.id, { field: 'Problem id' }));
    if (!existing) throw ApiError.notFound('Report not found.');
    const status = v.oneOf(v.pick(req.body, ['status']).status, ['open', 'resolved'], { field: 'Status' });
    const problem = await store.updateProblem(existing.id, { status, handledBy: req.user.name });
    await logActivity({
      actor: req.user.name,
      action: `Marked the report from "${existing.reporterName}" as ${status}.`,
      level: 'admin',
      page: '/admin/problems/',
    });
    res.json({ problem });
  })
);

/** Accepts ISO date input only (YYYY-MM-DD); anything else becomes empty rather than stored raw. */
function normaliseDate(value) {
  if (value === undefined || value === null || value === '') return '';
  const text = String(value).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

module.exports = router;
