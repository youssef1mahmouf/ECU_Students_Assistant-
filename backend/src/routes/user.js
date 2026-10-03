'use strict';
/**
 * User-area endpoints. The acting user is always taken from the session; the requested
 * group is never taken from the client, so a user cannot read another group's content by
 * editing a URL or a fetch call. `/groups` answers with the caller's own group only -
 * the list of joinable group names is the deliberately public `/api/public/groups`.
 */
const express = require('express');
const { store } = require('../db/store');
const v = require('../lib/validate');
const { ApiError, asyncHandler } = require('../lib/errors');
const { requireAuth, requireConfirmedMember } = require('../middleware/auth');
const { selfView, permissionsFor } = require('../lib/dto');
const { logActivity } = require('../services/activity');
const { sendEmail } = require('../services/mailer');
const config = require('../config/env');

const router = express.Router();
router.use(requireAuth);

/** The caller's full name exactly as printed on the imported roster PDF (display only). */
async function rosterNameFor(user) {
  const entry = user.email ? await store.findRosterByEmail(user.email) : null;
  return entry && entry.name ? entry.name : '';
}

router.get(
  '/profile',
  asyncHandler(async (req, res) => {
    const [records, rosterName] = await Promise.all([
      req.user.group && req.user.confirmed
        ? store.listRecords({ group: req.user.group, publishedOnly: true })
        : Promise.resolve([]),
      rosterNameFor(req.user),
    ]);
    res.json({
      user: { ...selfView(req.user), rosterName },
      permissions: permissionsFor(req.user),
      recordCount: records.length,
    });
  })
);

router.patch(
  '/profile',
  asyncHandler(async (req, res) => {
    const body = v.pick(req.body, ['name']);
    const name = v.str(body.name, { field: 'Name', min: 3, max: 80 });
    // Only the display name is writable here. Roster identity, group, email and role are
    // never taken from this request - they come from the roster and from admin actions.
    const updated = await store.updateUser(req.user.id, { name });
    await logActivity({
      actor: name,
      action: 'Updated their profile name.',
      level: 'info',
      page: '/user/profile/',
      actorRole: req.user.role,
    });
    res.json({ user: selfView(updated), permissions: permissionsFor(updated) });
  })
);

/** The caller's own group only (at most one row). The full catalogue lives behind the
 *  admin API; joinable group names are published deliberately on /api/public/groups. */
router.get(
  '/groups',
  asyncHandler(async (req, res) => {
    const groups = req.user.group ? await store.listGroups() : [];
    const own = groups.filter((group) => group.name === req.user.group);
    res.json({
      groups: own.map((group) => ({
        name: group.name,
        description: group.description || '',
        isMine: true,
      })),
      currentGroup: req.user.group || '',
      confirmed: Boolean(req.user.confirmed),
    });
  })
);

/** Join or move group. Any move needs a fresh approval from an administrator. */
router.post(
  '/group-request',
  asyncHandler(async (req, res) => {
    const group = v.groupName(v.pick(req.body, ['group']).group, { field: 'Group' });
    if (!(await store.findGroupByName(group))) throw ApiError.badRequest('The selected group is not available.');
    const previous = req.user.group || 'none';
    const updated = await store.updateUser(req.user.id, { group, confirmed: false });
    await logActivity({
      actor: req.user.name,
      action: `Requested group change: ${previous} -> ${group}.`,
      level: 'info',
      page: '/user/groups/',
      actorRole: req.user.role,
    });
    res.json({
      message: 'Request sent. An administrator must approve the new group.',
      user: selfView(updated),
      permissions: permissionsFor(updated),
    });
  })
);

/** Group content. Rejected unless the account is confirmed for that stored group. */
router.get(
  '/records',
  requireConfirmedMember,
  asyncHandler(async (req, res) => {
    const group = req.user.group;
    // Drafts are staff-only: unpublished records never leave the admin API. The store
    // matches the caller's group against every group a record is assigned to.
    const records = await store.listRecords({ group, publishedOnly: true });
    res.json({
      group,
      records: records.map((record) => ({
        id: record.id,
        title: record.title,
        groups: Array.isArray(record.groups) && record.groups.length ? record.groups : [record.group].filter(Boolean),
        kind: record.kind || '',
        dueDate: record.dueDate || '',
        summary: record.summary || '',
        body: record.body || '',
        published: Boolean(record.published),
        createdAt: record.createdAt,
      })),
    });
  })
);

/* ---------------------------------------------------------- problem reports */
const PROBLEM_CATEGORIES = ['bug', 'content', 'account', 'group', 'other'];

/**
 * "Report a problem": stored persistently and shown to staff at /admin/problems/;
 * a notification is also sent to the configured owner inbox when mail is available.
 */
router.post(
  '/problems',
  asyncHandler(async (req, res) => {
    const body = v.pick(req.body, ['category', 'page', 'description']);
    const category = v.oneOf(body.category || 'other', PROBLEM_CATEGORIES, { field: 'Category' });
    const page = v.str(body.page, { field: 'Page', max: 200, optional: true });
    const description = v.str(body.description, { field: 'Description', min: 10, max: 2000 });
    const problem = await store.createProblem({
      reporterId: req.user.id,
      reporterName: req.user.name,
      reporterEmail: req.user.email,
      reporterRole: req.user.role,
      category,
      page,
      description,
      status: 'open',
    });
    await logActivity({
      actor: req.user.name,
      action: `Submitted a problem report (${category}).`,
      level: 'info',
      page: '/user/report/',
      actorRole: req.user.role,
    });
    let emailSent = false;
    if (config.mail.apiKey && config.mail.from && config.mail.reportTo) {
      try {
        await sendEmail({
          to: config.mail.reportTo,
          subject: `ECU portal problem report: ${category}`,
          text: [
            `Reporter: ${problem.reporterName} <${problem.reporterEmail}>`,
            `Reported at: ${problem.createdAt}`,
            `Page: ${problem.page || '(not supplied)'}`,
            `Category: ${problem.category}`,
            '',
            'Description:',
            problem.description,
          ].join('\n'),
        });
        emailSent = true;
      } catch (error) {
        console.error('[mail] problem report notification failed:', error.status || error.message);
      }
    }
    res.status(201).json({
      message: emailSent
        ? 'Report saved and email notification sent.'
        : 'Report saved. An administrator will see it in the reports list; email notification was not sent.',
      emailSent,
      problem: {
        id: problem.id,
        category: problem.category,
        page: problem.page,
        status: problem.status,
        createdAt: problem.createdAt,
      },
    });
  })
);

module.exports = router;
