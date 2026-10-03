/**
 * Page chrome shared by every area: one header, role-aware navigation, footer and the
 * language switch.
 *
 * The role that decides which links appear comes from /api/auth/me (loadSession), never
 * from localStorage or from the URL. Hiding a link is only a convenience: the server
 * guards every admin route and page independently.
 */
import { escapeHtml, initials } from './ui.js';
import { t, applyI18n, mountLanguageToggle, onLanguageChange } from './i18n.js';
import { currentUser, permissions, loadSession, signOut } from './session.js';

/* Theme choice is remembered per browser and applied as <html data-theme="dark">. It lives here
   because the header is rendered on every page, so this is the one place that can set it. */
const THEME_KEY = 'ga6_theme';

function readTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === 'dark' || saved === 'light' ? saved : null;
  } catch {
    return null;
  }
}

export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'dark' || theme === 'light') {
    root.setAttribute('data-theme', theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* private mode: lasts this page only */ }
  } else {
    root.removeAttribute('data-theme');
    try { localStorage.removeItem(THEME_KEY); } catch { /* nothing stored */ }
  }
  return theme;
}

export function currentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

/** Light/dark switch in the header. The label always names what the button will switch to. */
export function mountThemeToggle(button = document.getElementById('themeToggle')) {
  if (!button || button.dataset.wired) return;
  button.dataset.wired = '1';
  const paint = () => {
    const dark = currentTheme() === 'dark';
    button.setAttribute('aria-pressed', String(dark));
    button.title = dark ? 'Switch to the light theme' : 'Switch to the dark theme';
    button.textContent = dark ? '☀' : '☾';
  };
  button.addEventListener('click', () => {
    applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
    paint();
  });
  paint();
}

/* Restore the saved theme before the first paint of any page. */
applyTheme(readTheme());

/* Every entry is a route the server really serves. Admin links carry the capability the
   permission matrix requires; the nav only shows what the signed-in role actually holds
   (the server enforces the same rule regardless). There is no separate "admin area" link
   for signed-out visitors: everyone signs in at /user/signin/ and is routed by role. */
const PUBLIC_LINKS = [
  /* Home is the landing page rendered as a visitor sees it, so the join and sign-in pages land
     on exactly what the public homepage shows rather than on a role area. */
  { href: '/?preview=visitor', key: 'nav.home', id: 'home' },
  { href: '/guest/assessments/', key: 'nav.assessments', id: 'assessments' },
];
const STUDENT_LINKS = [
  { href: '/user/', key: 'nav.home', id: 'home' },
  { href: '/user/groups/', key: 'nav.groups', id: 'groups' },
  { href: '/user/documents/', key: 'nav.documents', id: 'documents' },
  { href: '/guest/assessments/', key: 'nav.assessments', id: 'assessments' },
  { href: '/user/report/', key: 'nav.report', id: 'report' },
];
const ADMIN_LINKS = [
  /* "Home" opens the public landing page exactly as a visitor sees it, so it carries the preview
     flag. The dashboard keeps its own slot in the nav and never masquerades as the home page. */
  { href: '/?preview=visitor', key: 'nav.home', id: 'home' },
  { href: '/admin/dashboard/', key: 'admin.dashboard', id: 'dashboard', cap: 'dashboard' },
  { href: '/admin/groups/', key: 'admin.groups', id: 'groups', cap: 'groupsView' },
  { href: '/admin/accounts/', key: 'admin.accounts', id: 'accounts', cap: 'accountsView' },
  { href: '/admin/subjects/', key: 'nav.subjects', id: 'subjects', cap: 'subjectsManage' },
  { href: '/admin/documents/', key: 'nav.documents', id: 'documents', cap: 'documentsView' },
  { href: '/admin/activity/', key: 'admin.activity', id: 'activity', cap: 'activityView' },
  { href: '/admin/problems/', key: 'admin.problems', id: 'problems', cap: 'problemsView' },
  { href: '/admin/information/', key: 'admin.information', id: 'information', cap: 'reportsView' },
];

let booted = { area: 'guest', active: '', preview: false };

function capabilities() {
  const list = permissions().capabilities;
  return Array.isArray(list) ? list : [];
}

/** The links this visitor may use, taken from the session the server confirmed. */
export function navLinks({ area = 'guest', staff = false } = {}) {
  if (staff || area === 'admin') {
    const held = capabilities();
    return ADMIN_LINKS.filter((link) => !link.cap || held.includes(link.cap));
  }
  const user = currentUser();
  if (user) return permissions().isAdmin ? ADMIN_LINKS.filter((link) => !link.cap || capabilities().includes(link.cap)) : STUDENT_LINKS;
  return PUBLIC_LINKS;
}

/** Links shown inside the account menu. Staff never see student-only wording here. */
function accountLinks({ staff = false } = {}) {
  if (staff) {
    const held = capabilities();
    return [
      /* Plain "Home": the public landing page seen as a visitor. It is the one address every
         role shares, so the brand, the nav and this menu all point at the same place. */
      { href: '/?preview=visitor', key: 'nav.home' },
      { href: '/admin/dashboard/', key: 'admin.dashboard' },
      /* Home and Dashboard are listed once, above, so they are skipped in the spread. */
      ...ADMIN_LINKS.filter((link) => link.id !== 'home' && link.id !== 'dashboard'
        && (!link.cap || held.includes(link.cap))),
      { href: '/admin/profile/', key: 'nav.profile' },
    ];
  }
  return [
    { href: '/user/', key: 'nav.home' },
    { href: '/user/groups/', key: 'nav.groups' },
    { href: '/user/documents/', key: 'nav.documents' },
    { href: '/user/report/', key: 'nav.report' },
    { href: '/user/profile/', key: 'nav.profile' },
  ];
}

/**
 * Renders the header. `active` marks the current page for aria-current. Links stay plain
 * hrefs so the pages work with JavaScript disabled; only the menu behaviour needs script.
 */
export function renderHeader({ area = 'user', active = '', preview = false } = {}) {
  const header = document.getElementById('appHeader');
  if (!header) return;
  /* Preview mode renders the public chrome exactly as an anonymous visitor receives it;
     it hides nothing from the server and grants nothing - it is display only. The one
     exception requested by the portal owner: a signed-in member keeps the staff chrome on the
     preview page, so the header they see while previewing is the one they actually use. */
  const signedIn = Boolean(currentUser());
  const user = preview ? null : currentUser();
  const staff = preview ? signedIn && Boolean(permissions().isAdmin) : Boolean(permissions().isAdmin);
  const links = preview
    ? (staff ? ADMIN_LINKS : PUBLIC_LINKS)
    : navLinks({ area, staff });
  /* The brand is the one address every role shares, so it always opens the landing page. */
  const brandHref = '/?preview=visitor';
  const roleText = user ? t(`role.${user.role}`) : t('brand.sub');

  header.innerHTML = `
  <a class="brand" href="${brandHref}">
    <span class="brand-mark" aria-hidden="true">${staff ? 'A' : 'م'}</span>
    <span>${escapeHtml(t('brand'))}<small>${escapeHtml(roleText)}</small></span>
  </a>
  <button class="nav-toggle" id="navToggle" type="button" aria-controls="primaryNav"
          aria-expanded="false" data-i18n-label="nav.openMenu">
    <span class="nav-toggle-bar" aria-hidden="true"></span>
    <span class="nav-toggle-bar" aria-hidden="true"></span>
    <span class="nav-toggle-bar" aria-hidden="true"></span>
    <span class="visually-hidden" data-i18n="nav.menu">${escapeHtml(t('nav.menu'))}</span>
  </button>
  <nav class="header-nav" id="primaryNav" aria-label="${escapeHtml(t('nav.menu'))}">
    ${links
      .map(
        (link) =>
          `<a href="${link.href}"${link.id === active ? ' class="active" aria-current="page"' : ''} data-i18n="${link.key}">${escapeHtml(t(link.key))}</a>`
      )
      .join('')}
  </nav>
  <div class="header-actions">
    <button class="language-button" id="languageToggle" type="button"></button>
    <button class="language-button" id="themeToggle" type="button" aria-pressed="false"></button>
    ${user ? accountMenu(user, { staff }) : signedIn ? accountMenu(currentUser(), { staff }) : signInLinks()}
  </div>`;

  mountLanguageToggle(document.getElementById('languageToggle'));
  wireHeaderBehaviour(header);
  applyI18n(header);
  /* Painted last: applyI18n rewrites every labelled node in the header, and the theme button
     must keep its own glyph rather than inheriting the language button's text. */
  mountThemeToggle(document.getElementById('themeToggle'));
}

function signInLinks() {
  return `<a class="btn small" href="/user/signin/" data-i18n="nav.signin">${escapeHtml(t('nav.signin'))}</a>
          <a class="btn secondary small" href="/user/register/" data-i18n="nav.register">${escapeHtml(t('nav.register'))}</a>`;
}

/** Name button plus panel: aria-expanded stays in step, Escape and Tab out close it. */
function accountMenu(user, { staff = false } = {}) {
  const links = accountLinks({ staff });
  return `<div class="account-menu" id="accountMenu">
    <button class="account-button" id="accountButton" type="button" aria-expanded="false"
            aria-controls="accountPanel" aria-haspopup="true"
            aria-label="${escapeHtml(t('nav.signedInAs', { name: user.name }))}">
      <span class="header-avatar" aria-hidden="true">${escapeHtml(initials(user.name))}</span>
      <span class="account-name">${escapeHtml(user.name)}</span>
      <span class="account-caret" aria-hidden="true">▾</span>
    </button>
    <div class="account-panel" id="accountPanel" hidden>
      <p class="account-email">${escapeHtml(user.email)}</p>
      ${links
        .map((link) => `<a href="${link.href}" data-i18n="${link.key}">${escapeHtml(t(link.key))}</a>`)
        .join('')}
      <button class="btn secondary small account-signout" id="signOutButton" type="button"
              data-i18n="nav.logout">${escapeHtml(t('nav.logout'))}</button>
    </div>
  </div>`;
}

/** Menu open/close, mobile nav toggle and sign-out. Each control is wired once per render. */
function wireHeaderBehaviour(header) {
  const toggle = header.querySelector('#navToggle');
  const nav = header.querySelector('#primaryNav');
  if (toggle && nav && !toggle.dataset.wired) {
    toggle.dataset.wired = '1';
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.addEventListener('click', (event) => {
      if (event.target.closest('a')) {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  const button = header.querySelector('#accountButton');
  const panel = header.querySelector('#accountPanel');
  if (button && panel && !button.dataset.wired) {
    button.dataset.wired = '1';
    const close = ({ refocus = false } = {}) => {
      if (panel.hidden) return;
      panel.hidden = true;
      button.setAttribute('aria-expanded', 'false');
      if (refocus) button.focus();
    };
    button.addEventListener('click', () => {
      const opening = panel.hidden;
      panel.hidden = !opening;
      button.setAttribute('aria-expanded', opening ? 'true' : 'false');
      if (opening) panel.querySelector('a, button')?.focus();
    });
    panel.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close({ refocus: true });
      if (event.key === 'Tab' && !event.shiftKey && event.target === panel.lastElementChild) close();
    });
    document.addEventListener('click', (event) => {
      if (!event.target.closest('#accountMenu')) close();
    });
  }

  const signOutButton = header.querySelector('#signOutButton');
  if (signOutButton && !signOutButton.dataset.wired) {
    signOutButton.dataset.wired = '1';
    signOutButton.addEventListener('click', async () => {
      const staff = Boolean(permissions().isAdmin);
      signOutButton.disabled = true;
      /* The header is redrawn for a signed-out visitor before the browser moves on, so the
         account menu never lingers on a page that no longer belongs to the session. */
      await signOut({ redirectTo: staff ? '/admin/' : '/' });
    });
  }
}

/** Standard footer for every area, including the contact details of the site owner. */
export function renderFooter() {
  const footer = document.getElementById('appFooter');
  if (!footer) return;
  footer.innerHTML = `<span data-i18n="footer.createdBy">${escapeHtml(t('footer.createdBy'))}</span>
    Youssef Mahmoud Shaban · <span data-i18n="footer.contact">${escapeHtml(t('footer.contact'))}</span>:
    <a href="https://wa.me/201102734090" target="_blank" rel="noopener noreferrer" dir="ltr">01102734090</a>
    · <a href="/guest/assessments/" data-i18n="nav.assessments">${escapeHtml(t('nav.assessments'))}</a>`;
  applyI18n(footer);
}

/**
 * Re-draws the header and footer after the session changed (sign-in, sign-out, a new
 * profile name) so navigation matches the new state without a manual page reload.
 */
export function refreshChrome(options = {}) {
  booted = { ...booted, ...options };
  renderHeader(booted);
  renderFooter();
  applyI18n();
}

/** Shared boot step: the session is resolved first so the header shows the real role. */
let chromeWired = false;

export async function bootChrome(options = {}) {
  await loadSession();
  booted = { area: options.area || 'guest', active: options.active || '', preview: Boolean(options.preview) };
  renderHeader(booted);
  renderFooter();
  applyI18n();

  if (chromeWired) return booted;
  chromeWired = true;

  /* A page restored from the back/forward cache still holds the language and the role of
     the moment it was drawn, so the chrome is rebuilt when it is shown again. */
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) void bootChrome(booted);
  });

  /* Redraw on a language switch: link labels come from the dictionary. */
  onLanguageChange(() => refreshChrome());
  return booted;
}