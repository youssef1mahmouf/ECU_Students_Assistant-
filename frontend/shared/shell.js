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
import { currentUser, permissions, loadSession, signOut, onSessionChange } from '/shared/session.js';
import { navigationFor, topbarIdsFor, sidebarSectionsFor, accountLinksFor } from '/shared/nav.js';
import { mountAppearanceToggle } from '/shared/theme.js';
import { refreshViews } from '/shared/ui/view.js';
import { bellItems, notificationsFor, unreadCount, markAllSeen } from '/shared/notifications.js';

let booted = { area: 'guest', active: '', preview: false };
let shellWired = false;

/* --------------------------------------------------------------- identity */

/* Where the brand goes. Home for a visitor, and the account's own landing page
   once there is a session - so the logo on /user/signin/ does not send a
   signed-out visitor to /user/, which would only bounce them straight back to
   the sign-in page they came from. Derived from the same session the rest of
   the shell reads; no path is hard-coded per page. */
function brandHome() {
  if (booted.area === 'admin' && permissions().isAdmin) return '/admin/dashboard/';
  if (booted.area === 'user' && currentUser()) return '/user/';
  return '/';
}

function brandMarkup() {
  const home = brandHome();
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
  /* The stylesheet gives the bar three equal-purpose columns - brand,
     navigation, actions - so the navigation is centred by the grid, not by a
     margin that would only centre it in the space the brand happened to leave. */
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

  /* Arrow keys move between the entries, and Home/End jump to the ends. A menu
     the mouse can open but the keyboard cannot move through is not a menu. */
  panel.addEventListener('keydown', (event) => {
    const items = [...panel.querySelectorAll('a, button')].filter((el) => !el.disabled && el.offsetParent !== null);
    if (!items.length) return;
    const here = items.indexOf(document.activeElement);
    let next = -1;
    if (event.key === 'ArrowDown') next = here < 0 ? 0 : (here + 1) % items.length;
    else if (event.key === 'ArrowUp') next = here < 0 ? items.length - 1 : (here - 1 + items.length) % items.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    if (next < 0) return;
    event.preventDefault();
    items[next].focus();
  });

  /* Registered once per document, not once per panel. wirePanel() runs on every
     redraw of the header, and a listener that closes the panel it captured would
     otherwise keep a detached element alive and fire again on every later click. */
  if (!document.documentElement.dataset.outsideCloseWired) {
    document.documentElement.dataset.outsideCloseWired = '1';
    document.addEventListener('click', () => {
      for (const menu of document.querySelectorAll('.account-menu')) {
        const panelEl = menu.querySelector('.menu');
        const trigger = menu.querySelector('button');
        if (!panelEl || panelEl.hidden) continue;
        panelEl.hidden = true;
        trigger?.setAttribute('aria-expanded', 'false');
      }
    });
  }
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

  /* The element is held in `button`, never in a name that also exists in this
     module: a local `const signOut` used to shadow the imported signOut()
     function, so the click handler called an HTMLElement and threw
     "signOut is not a function" instead of signing anyone out. */
  const button = document.getElementById('signOutButton');
  if (button && !button.dataset.wired) {
    button.dataset.wired = '1';
    button.addEventListener('click', () => {
      /* One click, one logout. Re-entrancy is blocked so a double click cannot
         fire two requests, the second of which would 401 after the first
         already destroyed the session. */
      if (button.dataset.busy === '1') return;
      button.dataset.busy = '1';
      signOut({ redirectTo: '/' });
    });
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

    /* Signing out changes what the chrome is allowed to show. Redrawing here is
       what removes the account menu, the bell and the protected navigation from
       the document at once; without it they would sit on screen until the
       redirect finished, and would come back from the back/forward cache if it
       never did. Registered after the first loadSession() above, so booting does
       not immediately redraw itself. */
    onSessionChange(() => refreshChrome());
  }

  return booted;
}

/** Current shell configuration, for a page that needs to know its area. */
export function shellState() {
  return booted;
}
