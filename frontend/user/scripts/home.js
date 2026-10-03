import { bootChrome } from '/shared/layout.js';
import { api } from '/shared/api.js';
import { escapeHtml, formatDate, mount } from '/shared/ui.js';
import { t } from '/shared/i18n.js';
import { currentUser, loadSession } from '/shared/session.js';

await bootChrome({ area: 'user', active: 'home' });
const session = await loadSession({ force: true });
const user = session.user;

if (new URLSearchParams(window.location.search).get('denied') === '1') {
  mount('#userBanner', `<div class="banner error" role="alert">${escapeHtml(t('msg.denied'))}</div>`);
}

if (!user) {
  mount(
    '#groupCards',
    `<p class="empty">${escapeHtml(t('user.signInToSee'))}</p>`
  );
  mount('#myRecords', `<p class="empty">${escapeHtml(t('msg.empty'))}</p>`);
} else if (!user.confirmed) {
  mount(
    '#userBanner',
    `<div class="banner" role="status">${escapeHtml(t('user.pendingNotice'))}</div>`
  );
}

const groups = await api.getQuiet('/api/public/groups');
const groupList = groups?.groups || [];
mount(
  '#groupCards',
  groupList.length
    ? groupList
        .map(
          (group) => `<article class="group-card${user && user.group === group.name ? ' is-mine' : ''}">
        <h3>${escapeHtml(group.name)}</h3>
        <p>${escapeHtml(group.description || '')}</p>
        ${user && user.group === group.name
          ? `<span class="badge ok">${escapeHtml(t('nav.groups'))}</span>`
          : `<a class="btn secondary small" href="/user/groups/">${escapeHtml(t('action.join'))}</a>`}
      </article>`
        )
        .join('')
    : `<p class="empty">${escapeHtml(t('msg.empty'))}</p>`
);

if (user && user.permissions?.canReadGroupContent) {
  const records = await api.getQuiet('/api/user/records');
  const rows = records?.records || [];
  mount(
    '#myRecords',
    rows.length
      ? rows
          .map(
            (record) => `<article class="list-row">
          <div class="row-main">
            <strong>${escapeHtml(record.title)}</strong>
            <small>${escapeHtml(record.summary || '')}</small>
          </div>
          <div class="row-actions">
            ${record.kind ? `<span class="badge">${escapeHtml(record.kind)}</span>` : ''}
            ${record.dueDate ? `<span class="badge warn">${escapeHtml(formatDate(record.dueDate))}</span>` : ''}
          </div>
        </article>`
          )
          .join('')
      : `<p class="empty">${escapeHtml(t('msg.empty'))}</p>`
  );
} else if (user) {
  mount('#myRecords', `<p class="empty">${escapeHtml(t('user.pendingNotice'))}</p>`);
}

if (user) document.getElementById('homeLead').textContent = `${t('field.group')}: ${user.group || '-'}`;
