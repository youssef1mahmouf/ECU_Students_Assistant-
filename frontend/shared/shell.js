/**
 * The one application shell.
 *
 * Every page in all three areas (guest, student, admin) uses this module, which
 * is what makes the portal feel like a single product instead of three sites:
 * the same header, the same account menu, the same notification bell, the same
 * theme control, the same footer, the same error and loading vocabulary.
 *
 * The contract with the page markup is deliberately tiny. A page declares the
 * frame in HTML and gives the shell three empty regions to fill:
 *
 *     <header class="topbar" id="appHeader"></header>
 *     <aside   class="sidebar" id="appSidebar"></aside>   <!-- optional -->
 *     <footer  class="footer"  id="appFooter"></footer>
 *
 * The shell never invents page content: it draws navigation, identity and
 * controls only. Everything a page shows is written by that page's own view
 * module, so there is no UI that exists without an understandable source.
 */
import '/shared/theme.js';
import { escapeHtml, initials, svg } from '/shared/ui.js';
import { t, applyI18n, mountLanguageToggle, onLanguageChange } from '/shared/i18n.js';
import { currentUser, permissions, loadSession, signOut } from '/shared/session.js';
import { navigationFor, topbarIdsFor, sidebarSectionsFor, accountLinksFor } from '/shared/nav.js';
import { mountAppearanceToggle } from '/shared/theme.js';
import { refreshViews } from '/shared/ui/view.js';
import { bellItems, notificationsFor, unreadCount, markAllSeen } from '/shared/notifications.js';

let booted = { area: 'guest', active: '', preview: false };
let shellWired = false;

/* --------------------------------------------------------------- identity */

function brandMarkup() {
  const home = booted.area === 'admin' ? '/admin/dashboard/' : booted.area === 'user' ? '/user/' : '/';
  return `<a class="brand" href="${home}">
      <span class="brand__mark" aria-hidden="true">ECU</span>
      <span class="brand__text">
        <span class="brand__name">${escapeHtml(t('brand.name'))}</span>
        <span class="brand__tag">${escapeHtml(t('brand.tag'))}</span>
      </span>
    </a>`;
}

function topnavMarkup() {
  const wanted = new Set(topbarIdsFor(booted.area));
  const links = navigationFor(booted.area).filter((link) => wanted.has(link.id));
  if (!links.length) return '';
  return `<nav class="topnav" id="primaryNav" aria-label="${escapeHtml(t('nav.menu'))}">${links
    .map(
      (link) =>
        `<a class="topnav__link" href="${link.href}"${link.id === booted.active ? ' aria-current="page"' : ''}>` +
        `${svg(link.icon)}<span>${escapeHtml(t(link.key))}</span></a>`
    )
    .join('')}</nav>`;
}

/**
 * The bell. It only appears for a signed-in account, and it only ever renders
 * real items derived from an endpoint the reader could call directly.
 */
function bellMarkup(user) {
  if (!user) return '';
  const href = booted.area === 'admin' ? '/admin/notifications/' : '/user/notifications/';
  return `<div class="account-menu" id="bellMenu">
      <button class="icon-btn" id="bellButton" type="button" aria-expanded="false" aria-controls="bellPanel"
              aria-haspopup="true" title="${escapeHtml(t('nav.notifications'))}">
        ${svg('bell')}
        <span class="bell-badge" id="bellCount" hidden></span>
      </button>
      <div class="menu" id="bellPanel" hidden>
        <div class="menu__header cluster cluster--between">
          <span class="menu__label">${escapeHtml(t('nav.notifications'))}</span>
          <a class="small" href="${href}">${escapeHtml(t('action.viewAll'))}</a>
        </div>
        <div id="bellList"></div>
      </div>
    </div>`;
}

function accountMarkup(user) {
  if (!user) {
    return `<div class="cluster cluster--tight">
        <a class="btn btn--primary btn--sm" href="/user/signin/">${escapeHtml(t('nav.signin'))}</a>
        <a class="btn btn--secondary btn--sm" href="/user/register/">${escapeHtml(t('nav.register'))}</a>
      </div>`;
  }

  const links = accountLinksFor(booted.area);
  return `<div class="account-menu" id="accountMenu">
      <button class="account-button" id="accountButton" type="button" aria-expanded="false"
              aria-controls="accountPanel" aria-haspopup="true"
              aria-label="${escapeHtml(t('nav.signedInAs', { name: user.name }))}">
        <span class="avatar" aria-hidden="true">${escapeHtml(initials(user.name))}</span>
        <span class="account-name">${escapeHtml(user.name)}</span>
        ${svg('chevron-down', { size: '0.9rem' })}
      </button>
      <div class="menu" id="accountPanel" hidden>
        <div class="menu__header">
          <p class="account-name block">${escapeHtml(user.name)}</p>
          <p class="tiny subtle break" dir="ltr">${escapeHtml(user.email)}</p>
          <span class="badge badge--primary">${escapeHtml(t(`role.${user.role}`))}</span>
        </div>
        <ul class="menu__list">
          ${links
            .map((link) => `<li><a class="menu__link" href="${link.href}">${escapeHtml(t(link.key))}</a></li>`)
            .join('')}
          <li><button class="menu__item menu__item--danger" id="signOutButton" type="button">
            ${svg('log-out')}<span>${escapeHtml(t('nav.logout'))}</span></button></li>
        </ul>
      </div>
    </div>`;
}

/* ------------------------------------------------------------- rendering */

function renderHeader() {
  const header = document.getElementById('appHeader');
  if (!header) return;
  const user = currentUser();

  header.className = 'topbar';
  header.innerHTML = `<div class="topbar__inner">
      ${brandMarkup()}
      ${topnavMarkup()}
      <div class="topbar__actions">
        <button class="language-button" id="languageToggle" type="button"
                title="${escapeHtml(t('nav.language'))}"></button>
        <button class="icon-btn" id="appearanceToggle" type="button" data-appearance-toggle
                title="${escapeHtml(t('theme.system'))}"></button>
        ${bellMarkup(user)}
        ${accountMarkup(user)}
        <button class="icon-btn nav-toggle" id="navToggle" type="button" aria-controls="appSidebar"
                aria-expanded="false" title="${escapeHtml(t('nav.openMenu'))}">
          ${svg('panel-left')}
          <span class="visually-hidden">${escapeHtml(t('nav.menu'))}</span>
        </button>
      </div>
    </div>`;

  mountLanguageToggle(document.getElementById('languageToggle'));
  mountAppearanceToggle(document.getElementById('appearanceToggle'));
  wireHeaderBehaviour();
  applyI18n(header);
  void paintBell();
}

function renderSidebar() {
  const sidebar = document.getElementById('appSidebar');
  if (!sidebar) return;
  const sections = sidebarSectionsFor(booted.area);

  sidebar.className = 'sidebar';
  sidebar.innerHTML =
    sections
      .map(
        (section) => `<div class="sidebar__section">
        <p class="sidebar__heading">${escapeHtml(t(section.headingKey))}</p>
        ${section.items
          .map(
            (item) =>
              `<a class="sidebar__link" href="${item.href}"${item.id === booted.active ? ' aria-current="page"' : ''}>` +
              `${svg(item.icon)}<span>${escapeHtml(t(item.key))}</span></a>`
          )
          .join('')}
      </div>`
      )
      .join('');

  wireSidebarBehaviour();
  applyI18n(sidebar);
}

function renderFooter() {
  const footer = document.getElementById('appFooter');
  if (!footer) return;
  footer.className = 'footer';
  footer.innerHTML = `<div class="footer__inner">
      <p>${escapeHtml(t('footer.createdBy'))} &middot; ${escapeHtml(t('footer.owner'))}</p>
      <div class="footer__links">
        <a href="https://wa.me/201102734090" target="_blank" rel="noopener noreferrer" dir="ltr">01102734090</a>
        <a href="/guest/assessments/">${escapeHtml(t('nav.assessments'))}</a>
        <a href="/user/report/">${escapeHtml(t('nav.support'))}</a>
      </div>
    </div>`;
  applyI18n(footer);
}

/* ---------------------------------------------------------------- the bell */

/** Paints the bell panel and its count. Failures are silent: a badge is decoration. */
async function paintBell() {
  const user = currentUser();
  const panel = document.getElementById('bellList');
  const counter = document.getElementById('bellCount');
  if (!user || !panel || !counter) return;

  panel.innerHTML = '<p class="skeleton skeleton--row"></p>';
  let items = [];
  try {
    items = await notificationsFor(booted.area);
  } catch {
    items = [];
  }

  const unread = unreadCount(items);
  counter.textContent = unread > 9 ? '9+' : String(unread);
  counter.hidden = unread === 0;
  counter.setAttribute('aria-label', t('notif.unreadCount', { count: unread }));

  if (!items.length) {
    panel.innerHTML = `<p class="tiny subtle menu__empty">${escapeHtml(t('notif.none'))}</p>`;
    return;
  }

  const href = booted.area === 'admin' ? '/admin/notifications/' : '/user/notifications/';
  panel.innerHTML =
    `<ul class="menu__list">${bellItems(items)
      .map(
        (item) =>
          `<li><a class="menu__link" href="${item.href || href}">${svg('bell')}` +
          `<span class="truncate">${escapeHtml(item.title)}</span></a></li>`
      )
      .join('')}</ul>` +
    `<button class="menu__item" id="markSeenButton" type="button">${svg('check')}` +
    `<span>${escapeHtml(t('notif.markRead'))}</span></button>`;

  document.getElementById('markSeenButton')?.addEventListener('click', () => {
    markAllSeen();
    void paintBell();
  });
}

/* --------------------------------------------------------------- behaviour */

/**
 * One open panel at a time. Escape closes and returns focus to the trigger, Tab
 * out closes, and a click anywhere outside closes - the three rules a keyboard
 * user expects from a menu.
 */
function wirePanel(buttonId, panelId) {
  const button = document.getElementById(buttonId);
  const panel = document.getElementById(panelId);
  if (!button || !panel || button.dataset.wired) return;
  button.dataset.wired = '1';

  const close = ({ refocus = false } = {}) => {
    if (panel.hidden) return;
    panel.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    if (refocus) button.focus();
  };

  const openMenu = () => {
    /* Only one panel open: close the other one first. */
    for (const other of document.querySelectorAll('.menu:not([hidden])')) {
      if (other === panel) continue;
      other.hidden = true;
      other.closest('.account-menu')?.querySelector('button')?.setAttribute('aria-expanded', 'false');
    }
    panel.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    panel.querySelector('a, button')?.focus();
  };

  button.addEventListener('click', (event) => {
    event.stopPropagation();
    if (panel.hidden) openMenu();
    else close();
  });

  panel.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { close({ refocus: true }); return; }
    if (event.key === 'Tab' && !event.shiftKey && event.target === panel.lastElementChild) close();
  });

  panel.addEventListener('click', (event) => event.stopPropagation());
  document.addEventListener('click', () => close());
}

/** Drawer open/close for the mobile sidebar. */
function wireSidebarBehaviour() {
  const toggle = document.getElementById('navToggle');
  const sidebar = document.getElementById('appSidebar');
  if (!toggle || !sidebar || toggle.dataset.wired) return;
  toggle.dataset.wired = '1';

  const scrim = document.createElement('div');
  scrim.className = 'nav-scrim';
  scrim.hidden = true;
  scrim.setAttribute('aria-hidden', 'true');

  const setOpen = (open) => {
    sidebar.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    scrim.hidden = !open;
    if (open) sidebar.querySelector('a')?.focus();
    else toggle.focus();
  };

  toggle.addEventListener('click', () => setOpen(!sidebar.classList.contains('is-open')));
  scrim.addEventListener('click', () => setOpen(false));

  document.body.appendChild(scrim);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && sidebar.classList.contains('is-open')) setOpen(false);
  });
}

function wireHeaderBehaviour() {
  wirePanel('accountButton', 'accountPanel');
  wirePanel('bellButton', 'bellPanel');

  const signOut = document.getElementById('signOutButton');
  if (signOut && !signOut.dataset.wired) {
    signOut.dataset.wired = '1';
    signOut.addEventListener('click', () => signOut({ redirectTo: '/' }));
  }
}

/* ------------------------------------------------------------------- boot */

/** Re-draws the whole frame after the session or the language changed. */
export function refreshChrome() {
  renderHeader();
  renderSidebar();
  renderFooter();
  applyI18n();
  refreshViews();
}

/**
 * The single boot step every page awaits. The session is resolved first so the
 * navigation reflects the real role rather than a guess made before /api/auth/me
 * answered, and the shell is only wired once per document.
 */
export async function bootChrome({ area = 'guest', active = '', preview = false } = {}) {
  booted = { area, active, preview };
  await loadSession();

  renderHeader();
  renderSidebar();
  renderFooter();
  applyI18n();

  if (!shellWired) {
    shellWired = true;

    /* A page restored from the back/forward cache still holds the chrome of the
       moment it was drawn, so it is rebuilt when it is shown again. */
    window.addEventListener('pageshow', (event) => {
      if (event.persisted) void bootChrome(booted);
    });

    /* A language switch redraws navigation and every live view together. */
    onLanguageChange(() => refreshChrome());
  }

  return booted;
}

/** Current shell configuration, for a page that needs to know its area. */
export function shellState() {
  return booted;
}
