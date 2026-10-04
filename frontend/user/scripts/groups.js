/**
 * /user/groups/ - pick a group and read what this group has published.
 *
 * Two endpoints with two clear jobs:
 *   /api/user/groups  the caller's own group (never anyone else's)
 *   /api/public/groups the joinable names, which are deliberately public
 * A join request re-reads both and repaints, so the state after the click is
 * never a guess.
 */
import { bootChrome } from '/shared/shell.js';
import { api } from '/shared/api.js';
import { escapeHtml, svg, formatDate, showMessage, setBusy, confirmDialog, toast } from '/shared/ui.js';
import { t, kindLabel } from '/shared/i18n.js';
import { requireSignIn, currentUser } from '/shared/session.js';
import { createView } from '/shared/ui/view.js';
import { invalidateApi } from '/shared/api.js';

await bootChrome({ area: 'user', active: 'groups' });

const session = await requireSignIn({ redirectTo: '/user/signin/' });
if (!session) throw new Error('redirecting');

const user = currentUser();

if (user && !user.confirmed) {
  document.getElementById('userBanner').innerHTML =
    `<div class="notice notice--warning" role="status">${svg('clock')}
      <p class="notice__body">${escapeHtml(t('user.pendingNotice'))}</p></div>`;
}

let catalogue = [];
let mine = { groups: [], currentGroup: '', confirmed: false };

const groupView = createView('#groupCards', {
  load: async () => {
    [mine, catalogue] = await Promise.all([
      api.get('/api/user/groups'),
      api.get('/api/public/groups'),
    ]);
    return catalogue;
  },
  isEmpty: (data) => !(data?.groups || []).length,
  empty: { icon: 'users', titleKey: 'msg.empty', bodyKey: 'msg.emptyBody' },
  render: (data) => {
    const mineNames = new Set((mine.groups || []).map((row) => row.name));
    return data.groups
      .map((group) => {
        const isMine = mineNames.has(group.name);
        const isPending = group.name === mine.currentGroup && !mine.confirmed;
        return `<article class="card">
        <div class="card__head">
          <h3 class="card__title" dir="auto">${escapeHtml(group.name)}</h3>
          ${
            isMine
              ? `<span class="badge badge--success">${svg('check')}${escapeHtml(
                  mine.confirmed ? t('state.confirmed') : t('user.needApproval')
                )}</span>`
              : isPending
                ? `<span class="badge badge--warning">${escapeHtml(t('user.needApproval'))}</span>`
                : ''
          }
        </div>
        ${group.description ? `<p class="muted small">${escapeHtml(group.description)}</p>` : ''}
        ${
          isMine || isPending
            ? ''
            : `<div class="card__foot"><button class="btn btn--secondary btn--sm" type="button"
                 data-join="${escapeHtml(group.name)}">${svg('plus')}
                 <span>${escapeHtml(t('groups.join'))}</span></button></div>`
        }
      </article>`;
      })
      .join('');
  },
}).reload();

document.getElementById('groupCards').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-join]');
  if (!button) return;
  const group = button.dataset.join;
  if (!confirmDialog(t('confirm.joinGroup', { group }))) return;

  setBusy(button, true, t('msg.sending'));
  try {
    await api.post('/api/user/group-request', { group });
    /* The server changed this account, so every cached read for it is dropped
       and the page re-reads from scratch rather than showing a stale state. */
    invalidateApi(['/api/user', '/api/auth/me']);
    showMessage('groupMessage', t('groups.requestSent'), 'success');
    toast(t('groups.requestSent'), 'success');
    await groupView.reload();
  } catch (error) {
    showMessage('groupMessage', error.message, 'error');
    setBusy(button, false);
  }
});

/* --------------------------------------------------------- group content */

const contentView = createView('#groupRecords', {
  load: () => {
    if (!user?.permissions?.canReadGroupContent) {
      const error = new Error(t('user.pendingNotice'));
      error.code = 'NOT_APPROVED';
      throw error;
    }
    return api.get('/api/user/records');
  },
  isEmpty: (data) => !(data?.records || []).length,
  empty: { icon: 'list-checks', titleKey: 'user.noContentTitle', bodyKey: 'user.noContentBody' },
  render: (data) => `<ul class="rows card card--flush">${data.records
    .map(
      (record) => `<li class="row">
      <span class="tile__icon">${svg('list-checks')}</span>
      <span class="row__main">
        <span class="row__title">${escapeHtml(record.title)}</span>
        ${record.summary || record.body ? `<span class="row__sub">${escapeHtml(record.summary || record.body)}</span>` : ''}
      </span>
      <span class="row__meta">
        ${record.kind ? `<span class="badge">${escapeHtml(kindLabel(record.kind))}</span>` : ''}
        ${record.dueDate ? `<span class="badge badge--warning">${escapeHtml(formatDate(record.dueDate))}</span>` : ''}
      </span>
    </li>`
    )
    .join('')}</ul>`,
  error: (err) => (err?.code === 'NOT_APPROVED'
    ? { icon: 'lock', titleKey: 'user.pendingNotice', bodyKey: 'user.pendingBody' }
    : {}),
});

contentView.reload();
