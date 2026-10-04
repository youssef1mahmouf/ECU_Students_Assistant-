/**
 * The navigation registry: every route the portal serves, in one array.
 *
 * Before this file existed each page and both shells carried their own copy of
 * the link list, which is how /user/documents/ ended up hosting a library, a
 * document list and a loading card at the same time. Now:
 *
 *   - the shell reads this array to draw the topbar and the sidebar
 *   - a page names its own id and the shell marks that link current
 *   - backend/src/app.js mirrors `cap` in its ADMIN_PAGES / USER_PAGES guards
 *
 * `cap` is the capability the server already enforces. The UI hides a link the
 * server would refuse, but hiding is only a convenience: authorisation is decided
 * by backend/src/middleware/auth.js, never here.
 */
import { currentUser, permissions } from '/shared/session.js';

const ICONS = {
  dashboard: 'layout-dashboard',
  library: 'library',
  documents: 'file-text',
  assessments: 'list-checks',
  groups: 'users',
  subjects: 'book-open',
  accounts: 'users',
  activity: 'activity',
  problems: 'triangle-alert',
  information: 'info',
  security: 'shield-check',
  health: 'heart-pulse',
  notifications: 'bell',
  profile: 'user',
  settings: 'settings',
  support: 'circle-help',
  home: 'house',
};

/* --------------------------------------------------------------- student */
export const STUDENT_NAV = [
  { id: 'home', href: '/user/', key: 'nav.home', icon: ICONS.home },
  { id: 'library', href: '/user/library/', key: 'nav.library', icon: ICONS.library },
  { id: 'documents', href: '/user/documents/', key: 'nav.documents', icon: ICONS.documents },
  { id: 'groups', href: '/user/groups/', key: 'nav.groups', icon: ICONS.groups },
  { id: 'assessments', href: '/guest/assessments/', key: 'nav.assessments', icon: ICONS.assessments },
  { id: 'notifications', href: '/user/notifications/', key: 'nav.notifications', icon: ICONS.notifications },
  { id: 'support', href: '/user/report/', key: 'nav.support', icon: ICONS.support },
  { id: 'profile', href: '/user/profile/', key: 'nav.profile', icon: ICONS.profile },
  { id: 'settings', href: '/user/settings/', key: 'nav.settings', icon: ICONS.settings },
];

/* Only the four that also make sense in a wide bar. The rest live in the sidebar,
   so the topbar never wraps on a laptop. */
export const STUDENT_TOPBAR = ['home', 'library', 'documents', 'groups'];

/* ------------------------------------------------------------------ admin */
/* Grouped so the sidebar can show headings. One flat order, one system. */
export const ADMIN_NAV = [
  {
    headingKey: 'nav.sectionOverview',
    items: [
      { id: 'dashboard', href: '/admin/dashboard/', key: 'admin.dashboard', icon: ICONS.dashboard, cap: 'dashboard' },
      { id: 'notifications', href: '/admin/notifications/', key: 'nav.notifications', icon: ICONS.notifications, cap: 'dashboard' },
      { id: 'activity', href: '/admin/activity/', key: 'admin.activity', icon: ICONS.activity, cap: 'activityView' },
    ],
  },
  {
    headingKey: 'nav.sectionPeople',
    items: [
      { id: 'accounts', href: '/admin/accounts/', key: 'admin.accounts', icon: ICONS.accounts, cap: 'accountsView' },
      { id: 'groups', href: '/admin/groups/', key: 'admin.groups', icon: ICONS.groups, cap: 'groupsView' },
    ],
  },
  {
    headingKey: 'nav.sectionContent',
    items: [
      { id: 'library', href: '/admin/library/', key: 'admin.library', icon: ICONS.library, cap: 'documentsView' },
      { id: 'documents', href: '/admin/documents/', key: 'nav.documents', icon: ICONS.documents, cap: 'documentsView' },
      { id: 'subjects', href: '/admin/subjects/', key: 'nav.subjects', icon: ICONS.subjects, cap: 'subjectsManage' },
      { id: 'information', href: '/admin/information/', key: 'admin.information', icon: ICONS.information, cap: 'reportsView' },
      { id: 'problems', href: '/admin/problems/', key: 'admin.problems', icon: ICONS.problems, cap: 'problemsView' },
    ],
  },
  {
    headingKey: 'nav.sectionSystem',
    items: [
      { id: 'security', href: '/admin/security/', key: 'nav.security', icon: ICONS.security, cap: 'activityView' },
      { id: 'health', href: '/admin/health/', key: 'nav.health', icon: ICONS.health, cap: 'dashboard' },
      { id: 'settings', href: '/admin/settings/', key: 'nav.settings', icon: ICONS.settings },
    ],
  },
];

export const ADMIN_TOPBAR = ['dashboard', 'accounts', 'groups', 'documents', 'problems'];

/* ---------------------------------------------------------------- public */
/* A visitor sees the landing page and the published assessments. There is no
   admin link for a signed-out browser: everyone signs in at one address and is
   routed by role afterwards. */
export const PUBLIC_NAV = [
  { id: 'home', href: '/', key: 'nav.home', icon: ICONS.home },
  { id: 'assessments', href: '/guest/assessments/', key: 'nav.assessments', icon: ICONS.assessments },
];

export const PUBLIC_TOPBAR = ['home', 'assessments'];

function capabilities() {
  const list = permissions().capabilities;
  return Array.isArray(list) ? list : [];
}

/** The admin sections this role may actually open. Hiding, not permitting. */
export function adminSections() {
  const held = capabilities();
  return ADMIN_NAV
    .map((section) => ({ ...section, items: section.items.filter((item) => !item.cap || held.includes(item.cap)) }))
    .filter((section) => section.items.length);
}

/** Flattened admin links, used by the account menu and the topbar. */
export function adminItems() {
  return adminSections().flatMap((section) => section.items);
}

/**
 * The navigation for a page, honouring the signed-in role.
 * `active` is the id of the current page and gets aria-current="page".
 */
export function navigationFor(area) {
  if (area === 'admin') return adminItems();
  if (currentUser()) return STUDENT_NAV;
  return PUBLIC_NAV;
}

export function topbarIdsFor(area) {
  if (area === 'admin') return ADMIN_TOPBAR;
  if (currentUser()) return STUDENT_TOPBAR;
  return PUBLIC_TOPBAR;
}

/** Grouped view for the sidebar; a flat list for the topbar. */
export function sidebarSectionsFor(area) {
  if (area === 'admin') return adminSections();
  if (!currentUser()) return [{ headingKey: 'nav.sectionBrowse', items: PUBLIC_NAV }];
  return [{ headingKey: 'nav.sectionStudy', items: STUDENT_NAV }];
}

/** The account-menu entries. Staff never see student-only wording here. */
export function accountLinksFor(area) {
  if (area === 'admin') {
    return [
      { href: '/', key: 'nav.site' },
      ...adminItems()
        .filter((item) => item.id !== 'dashboard')
        .map((item) => ({ href: item.href, key: item.key })),
      { href: '/admin/profile/', key: 'nav.profile' },
      { href: '/admin/settings/', key: 'nav.settings' },
    ];
  }
  if (currentUser()) {
    return [
      { href: '/user/profile/', key: 'nav.profile' },
      { href: '/user/settings/', key: 'nav.settings' },
      { href: '/user/notifications/', key: 'nav.notifications' },
    ];
  }
  return [
    { href: '/user/signin/', key: 'nav.signin' },
    { href: '/user/register/', key: 'nav.register' },
  ];
}
