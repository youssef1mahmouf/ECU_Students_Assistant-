import { bootChrome } from '/shared/layout.js';
import { api } from '/shared/api.js';
import { escapeHtml, formatDate, mount } from '/shared/ui.js';
import { t } from '/shared/i18n.js';
import { loadSession } from '/shared/session.js';

/* Admin preview: /?preview=visitor renders the page as a visitor receives it, using the
   same public endpoints. Nothing is impersonated and no permission is bypassed. */
const preview = new URLSearchParams(window.location.search).get('preview') === 'visitor';

/* A member previewing the page already has the staff header and an account menu, so the
   landing hero - which only exists to ask a visitor to sign in - would be dead weight and
   would contradict that header. It is hidden for them; a real visitor still sees it. */
if (preview) {
  loadSession({ force: true }).then(({ user }) => {
    if (user) document.querySelector('.hero')?.setAttribute('hidden', '');
  }).catch(() => { /* stay signed out: the hero stays visible */ });
}

/* This is the public landing page. A visitor who is already signed in has no business
   reading "Sign in" and "Create account", so each role is sent to the area it owns. The
   explicit ?preview=visitor link is left alone - that is how staff inspect this page. */
if (!preview) {
  const { user, permissions } = await loadSession({ force: true });
  if (user) {
    window.location.replace(permissions?.isAdmin ? '/admin/dashboard/' : '/user/');
  }
}

async function loadPublicData() {
  const [assessments, groups, site] = await Promise.all([
    api.getQuiet('/api/public/assessments'),
    api.getQuiet('/api/public/groups'),
    api.getQuiet('/api/public/site'),
  ]);

  const rows = assessments?.assessments || [];
  mount(
    '#publicAssessments',
    rows.length
      ? rows
          .slice(0, 5)
          .map(
            (item) => `<article class="assessment-card">
        <div class="row-main">
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.summary || '')}</p>
          <small class="badge muted">${escapeHtml(item.group)}</small>
        </div>
        <div class="assessment-meta">
          ${item.kind ? `<span class="badge">${escapeHtml(item.kind)}</span>` : ''}
          ${item.dueDate ? `<small class="badge warn">${escapeHtml(formatDate(item.dueDate))}</small>` : ''}
        </div>
      </article>`
          )
          .join('')
      : `<p class="empty">${escapeHtml(t('msg.empty'))}</p>`
  );

  const groupsList = groups?.groups || [];
  mount(
    '#publicGroups',
    groupsList.length
      ? groupsList
          .map(
            (group) => `<article class="group-card">
        <h3>${escapeHtml(group.name)}</h3>
        <p>${escapeHtml(group.description || '')}</p>
        <a class="btn secondary small" href="/user/documents/?group=${encodeURIComponent(group.name)}" data-i18n="action.openGroup">${escapeHtml(t('action.openGroup'))}</a>
      </article>`
          )
          .join('')
      : `<p class="empty">${escapeHtml(t('msg.empty'))}</p>`
  );

  if (site?.title) document.title = `${site.title} · الصفحة العامة`;
}

await bootChrome({ area: 'guest', active: 'home', preview });
if (preview) {
  mount('#previewBanner', `<div class="banner info" role="status">${escapeHtml(t('guest.previewNotice'))}</div>`);
}
await loadPublicData();
