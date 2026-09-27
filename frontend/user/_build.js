const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const src = fs.readFileSync(path.join(DIR, 'script.js'), 'utf8').split(/\r?\n/);

// 1-indexed inclusive slice
function seg(a, b) { return src.slice(a - 1, b); }
function must(arr, find, label) {
  if (!arr.some(l => l.includes(find))) throw new Error('NO MATCH [' + label + ']: ' + find.slice(0, 90));
  return arr;
}
function rep(arr, find, repl, label) {
  must(arr, find, label);
  return arr.map(l => (l.includes(find) ? l.split(find).join(repl) : l));
}
function cut(arr, find, label) {
  must(arr, find, label);
  return arr.filter(l => !l.includes(find));
}
function out(name, arr) {
  const text = arr.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  fs.writeFileSync(path.join(DIR, name), text, 'utf8');
  console.log('wrote', name, arr.length, 'lines');
}

// ---------------------------------------------------------------- shared.js
let shared = []
  .concat(seg(1, 71))                                   // constants, translations, translatePage, setupLanguage, loadData
  .concat([
    '',
    '    // حالة التطبيق المشتركة بين كل الصفحات.',
    '    const PAGE = document.body.dataset.page || \'home\';',
    '    const BASE = document.body.dataset.base || \'.\';',
    '    let data = loadData();',
    '    let activeUserId = null;',
    '    const userContent = document.getElementById(\'userContent\');',
    '    if (userContent) {',
    '      userContent.addEventListener(\'click\', event => { const button = event.target.closest(\'[data-open-file]\'); if (!button) return; openStoredFile(button.dataset.openFile, Number(button.dataset.fileIndex)); });',
    '    }',
  ])
  .concat(seg(89, 101))                                 // saveData, escapeHtml, showMessage
  .concat(seg(145, 148))                                // recordActivity
  .concat(seg(243, 264));                               // attachmentMarkup, openStoredFile, recordLinksMarkup

// updateHeader(): viewMode -> PAGE, add groups nav
let hdr = seg(476, 513);
hdr = rep(hdr, 'document.getElementById(\'profileNav\').textContent = text(\'الملف الشخصي\');',
  'document.getElementById(\'profileNav\').textContent = text(\'الملف الشخصي\');\n      document.getElementById(\'groupsNav\').textContent = text(\'المجموعات\');', 'hdr-nav');
hdr = rep(hdr, 'toggle(\'active\', viewMode === \'home\')', 'toggle(\'active\', PAGE === \'home\')', 'hdr-home');
hdr = rep(hdr, 'toggle(\'active\', viewMode === \'signin\')', 'toggle(\'active\', PAGE === \'signin\' || PAGE === \'register\')', 'hdr-signin');
hdr = rep(hdr, 'toggle(\'active\', viewMode === \'profile\');',
  'toggle(\'active\', PAGE === \'profile\');\n      document.getElementById(\'groupsNav\').classList.toggle(\'active\', PAGE === \'groups\');', 'hdr-profile');

let listeners = seg(515, 517);
listeners = rep(listeners, '() => { if (activeUserId) { viewMode = \'profile\'; renderUser(); } }',
  '() => { if (activeUserId) window.location.href = pageUrl(\'profile\'); }', 'avatar');
listeners = listeners.concat([
  '',
  '    // التنقل بين الصفحات.',
  '    document.getElementById(\'brandHome\').addEventListener(\'click\', () => { window.location.href = homeUrl(); });',
  '    document.getElementById(\'mainNav\').addEventListener(\'click\', () => { window.location.href = homeUrl(); });',
  '    document.getElementById(\'signInNav\').addEventListener(\'click\', () => { window.location.href = pageUrl(\'signin\'); });',
  '    document.getElementById(\'profileNav\').addEventListener(\'click\', () => { window.location.href = pageUrl(\'profile\'); });',
  '    document.getElementById(\'groupsNav\').addEventListener(\'click\', () => { window.location.href = pageUrl(\'groups\'); });',
]);

let boot = seg(536, 554);
boot = rep(boot, 'const rememberedUserId = localStorage.getItem(SESSION_KEY);',
  'const rememberedUserId = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);', 'remember-src');
boot = rep(boot, 'if (rememberedUserId && data.users.some(user => user.id === rememberedUserId)) { activeUserId = rememberedUserId; viewMode = \'profile\'; }',
  'if (rememberedUserId && data.users.some(user => user.id === rememberedUserId)) activeUserId = rememberedUserId;', 'remember-set');

shared = shared
  .concat([''])
  .concat(hdr)
  .concat([''])
  .concat(listeners)
  .concat([''])
  .concat(boot)
  .concat([
    '',
    '    // أدوات مساعدة مشتركة بين الصفحات.',
    '    function currentUser() { return data.users.find(user => user.id === activeUserId) || null; }',
    '    function signOut() { activeUserId = null; localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY); }',
    '    function pageUrl(name) { return BASE + \'/\' + name + \'/index.html\'; }',
    '    function homeUrl() { return BASE + \'/index.html\'; }',
    '    function groupUrl(group, mode) { return BASE + \'/groups/index.html?group=\' + encodeURIComponent(group) + (mode ? \'&mode=\' + encodeURIComponent(mode) : \'\'); }',
    '',
    '    const FLASH_KEY = \'groupPortalFlashV1\';',
    '    function setFlash(kind, message) { try { sessionStorage.setItem(FLASH_KEY, JSON.stringify({ kind, message })); } catch (error) { /* تجاهل */ } }',
    '    function takeFlash() {',
    '      try {',
    '        const raw = sessionStorage.getItem(FLASH_KEY);',
    '        if (!raw) return null;',
    '        sessionStorage.removeItem(FLASH_KEY);',
    '        return JSON.parse(raw);',
    '      } catch (error) { return null; }',
    '    }',
    '    function renderFlash(target) { const flash = takeFlash(); if (flash && target) showMessage(target, flash.message, flash.kind); }',
    '',
    '    setupLanguage();',
    '    updateHeader();',
    '    translatePage();',
  ]);

out('shared.js', shared);

// --------------------------------------------------------------- page dirs
['home', 'signin', 'register', 'groups', 'profile'].forEach(d => fs.mkdirSync(path.join(DIR, d), { recursive: true }));

// ------------------------------------------------------------- home/script.js
let home = seg(519, 527);
home = rep(home, '<button class="btn small" type="button" data-home-group="${escapeHtml(group)}">${text(\'الدخول\')}</button>',
  '<a class="btn small" href="${groupUrl(group)}">${text(\'الدخول\')}</a>', 'home-open');
home = rep(home, '<button class="btn secondary small" type="button" data-signin-group="${escapeHtml(group)}">${text(\'سجّل الدخول للوصول\')}</button>',
  '<a class="btn secondary small" href="${pageUrl(\'signin\')}">${text(\'سجّل الدخول للوصول\')}</a>', 'home-signin-group');
home = rep(home, '<button class="btn" id="homeSignIn" type="button">${text(\'تسجيل الدخول\')}</button>',
  '<a class="btn" href="${pageUrl(\'signin\')}">${text(\'تسجيل الدخول\')}</a>', 'home-cta');
home = cut(home, 'document.getElementById(\'homeSignIn\')', 'home-cta-listener');
home = cut(home, 'data-home-group]\'', 'home-group-listener');
home = cut(home, 'data-signin-group]\'', 'home-signin-listener');
out('home/script.js', home.concat(['', '    renderHome();', '    translatePage();']));

// ----------------------------------------------------------- signin/script.js
let signin = seg(568, 570);
signin = rep(signin, '() => { userMode = \'register\'; renderUser(); }',
  '() => { window.location.href = pageUrl(\'register\'); }', 'signin-toreg');
let signinUser = seg(606, 617);
signinUser = cut(signinUser, 'viewMode = \'profile\';', 'login-viewmode');
signinUser = rep(signinUser, '      renderUser();', '      window.location.href = pageUrl(\'profile\');', 'login-render');
out('signin/script.js', [
  '    function renderSignIn() {',
].concat(signin.map(l => '  ' + l), [
  '      renderFlash(document.getElementById(\'userMessage\'));',
  '      updateHeader();',
  '      translatePage();',
  '    }',
  '',
  '    if (currentUser()) { window.location.href = pageUrl(\'profile\'); } else { renderSignIn(); }',
  '',
].concat(signinUser)));

// --------------------------------------------------------- register/script.js
let regForm = seg(563, 566);
regForm = rep(regForm, '() => { userMode = \'login\'; renderUser(); }',
  '() => { window.location.href = pageUrl(\'signin\'); }', 'reg-tologin');
let regUser = seg(586, 605);
regUser = rep(regUser, 'showMessage(message, text(\'تم إنشاء الحساب وحفظه. يمكنك تسجيل الدخول الآن.\'));',
  'setFlash(\'success\', text(\'تم إنشاء الحساب وحفظه. يمكنك تسجيل الدخول الآن.\'));', 'reg-flash');
regUser = rep(regUser, '      userMode = \'login\';', '      window.location.href = pageUrl(\'signin\');', 'reg-mode');
regUser = cut(regUser, 'window.setTimeout(renderUser, 700);', 'reg-timeout');
out('register/script.js', [
  '    function renderRegister() {',
].concat(regForm.map(l => '  ' + l), [
  '      updateHeader();',
  '      translatePage();',
  '    }',
  '',
  '    renderRegister();',
  '',
].concat(regUser)));

// ----------------------------------------------------------- groups/script.js
let gSubjects = seg(266, 278);
gSubjects = rep(gSubjects, 'if (readOnly && (!viewer || (viewer.role !== \'superAdmin\' && viewer.selectedGroup !== group))) return renderHome();',
  'if (readOnly && (!viewer || (viewer.role !== \'superAdmin\' && viewer.selectedGroup !== group))) return renderGroupsList();', 'gs-deny');
gSubjects = rep(gSubjects, '() => readOnly ? renderHome() : renderSuperAdmin(data.users.find(user => user.id === activeUserId))',
  '() => renderGroupsList()', 'gs-back');

let gDetails = seg(280, 286);
let gClasses = seg(288, 294);
let gMaterials = seg(296, 301);
let gSchedulePage = seg(303, 305);
let gRecords = seg(307, 329);
gRecords = rep(gRecords, '() => { editingRecordId = null; subject ? renderGroupSubjects(admin, group) : renderSuperAdmin(admin); }',
  '() => { editingRecordId = null; renderGroupSubjects(admin, group, false); }', 'gr-back');

out('groups/script.js', [
  '    let editingRecordId = null;',
  '',
  '    function renderGroupsList(noticeGroup) {',
  '      const viewer = currentUser();',
  '      const cards = data.groups.map(group => {',
  '        const count = data.records.filter(record => record.group === group).length;',
  '        const canOpen = viewer && (viewer.role === \'superAdmin\' || viewer.selectedGroup === group);',
  '        const action = canOpen',
  '          ? `<a class="btn small" href="${groupUrl(group)}">${text(\'الدخول\')}</a>`',
  '          : viewer',
  '            ? `<button class="btn secondary small" type="button" disabled>${text(\'مغلق\')}</button>`',
  '            : `<a class="btn secondary small" href="${pageUrl(\'signin\')}">${text(\'سجّل الدخول للوصول\')}</a>`;',
  '        return `<article class="group-card"><h3>${escapeHtml(group)}</h3><small>${count} ${text(\'سجل\')}</small>${action}</article>`;',
  '      }).join(\'\');',
  '      const notice = noticeGroup ? `<p class="message error">${text(\'هذه المجموعة لم تعد متاحة. اختر مجموعة أخرى.\')}</p>` : \'\';',
  '      userContent.innerHTML = `<p class="eyebrow">${text(\'المجموعات\')}</p><h2>${text(\'المجموعات المتاحة\')}</h2><p class="subtext">${text(\'المحتوى الذي أضافه السوبر أدمن فقط\')}</p>${notice}<div class="group-grid">${cards || `<p class="empty">${text(\'لا توجد مجموعات متاحة\')}</p>`}</div>`;',
  '      updateHeader();',
  '      translatePage();',
  '    }',
  '',
].concat(gSubjects.map(l => '  ' + l), [''], gDetails.map(l => '  ' + l), [''], gClasses.map(l => '  ' + l), [''],
  gMaterials.map(l => '  ' + l), [''], gSchedulePage.map(l => '  ' + l), [''], gRecords.map(l => '  ' + l), [''],
  '    (function bootGroups() {',
  '      const params = new URLSearchParams(window.location.search);',
  '      const groupParam = params.get(\'group\');',
  '      const modeParam = params.get(\'mode\');',
  '      const viewer = currentUser();',
  '      if (!groupParam || !data.groups.includes(groupParam)) return renderGroupsList(groupParam || null);',
  '      const isAdmin = Boolean(viewer && viewer.role === \'superAdmin\');',
  '      if (modeParam === \'schedule\' && isAdmin) { renderSchedulePage(viewer, groupParam); return; }',
  '      if (!isAdmin && (!viewer || viewer.selectedGroup !== groupParam)) return renderGroupsList(groupParam);',
  '      renderGroupSubjects(isAdmin ? viewer : null, groupParam, !isAdmin);',
  '    })();',
  '    translatePage();'));

// ---------------------------------------------------------- profile/script.js
let superAdmin = seg(150, 241);
superAdmin = rep(superAdmin, '<button class="btn small" type="button" data-open-group="${escapeHtml(group)}">${text(\'فتح\')}</button>',
  '<a class="btn small" href="${groupUrl(group)}">${text(\'فتح\')}</a>', 'sa-open');
superAdmin = rep(superAdmin, '<button class="btn secondary small" type="button" data-schedule-group="${escapeHtml(group)}">${text(\'رفع الجدول\')}</button>',
  '<a class="btn secondary small" href="${groupUrl(group, \'schedule\')}">${text(\'رفع الجدول\')}</a>', 'sa-schedule');
superAdmin = cut(superAdmin, 'document.querySelectorAll(\'[data-open-group]\')', 'sa-open-listener');
superAdmin = cut(superAdmin, 'document.querySelectorAll(\'[data-schedule-group]\')', 'sa-schedule-listener');
superAdmin = rep(superAdmin, '() => { activeUserId = null; localStorage.removeItem(SESSION_KEY); renderUser(); }',
  '() => { signOut(); window.location.href = homeUrl(); }', 'sa-logout');

let profileView = seg(575, 583);
// داخل renderUser كان المتغير المحلي اسمه currentUser؛ هنا اسمه user.
profileView = rep(profileView, 'currentUser.', 'user.', 'pv-rename');
profileView = rep(profileView, '() => { activeUserId = null; localStorage.removeItem(SESSION_KEY); renderUser(); }',
  '() => { signOut(); window.location.href = homeUrl(); }', 'pv-logout');
profileView = rep(profileView, '<button class="btn secondary small" id="openUserGroup" type="button">${text(\'فتح المجموعة\')}</button>',
  '<a class="btn secondary small" href="${groupUrl(user.selectedGroup)}">${text(\'فتح المجموعة\')}</a>', 'pv-opengroup');
profileView = cut(profileView, 'document.getElementById(\'openUserGroup\')', 'pv-opengroup-listener');
profileView = rep(profileView, 'user.confirmed = false; renderUser();',
  'user.confirmed = false; saveData(); renderProfile();', 'pv-changegroup');

let groupChoice = seg(619, 624);
groupChoice = rep(groupChoice, '() => { activeUserId = null; localStorage.removeItem(SESSION_KEY); renderUser(); }',
  '() => { signOut(); window.location.href = homeUrl(); }', 'gc-logout');
groupChoice = rep(groupChoice, 'error\'); renderUser(); });', 'error\'); renderProfile(); });', 'gc-confirm');

let savePostSeg = seg(626, 634);
savePostSeg = rep(savePostSeg, '      renderUser();', '      renderProfile();', 'sp-render');

out('profile/script.js', [
  '    let activityFilter = \'all\';',
  '',
  '    function renderProfile() {',
  '      const user = currentUser();',
  '      if (!user) { window.location.href = pageUrl(\'signin\'); return; }',
  '      if (user.role === \'superAdmin\') { renderSuperAdmin(user); translatePage(); return; }',
  '      if (!user.confirmed || !user.selectedGroup) { renderGroupChoice(user); translatePage(); return; }',
].concat(profileView.map(l => '  ' + l), [
  '      updateHeader();',
  '      translatePage();',
  '    }',
  '',
]).concat(groupChoice, [
  '',
]).concat(superAdmin.map(l => '  ' + l), [''], savePostSeg.map(l => '  ' + l), [''],
  '    renderProfile();'));

// -------------------------------------------------------------- HTML pages
const HEADER = [
  '  <header class="shell topbar">',
  '    <button class="brand-home" id="brandHome" type="button"><span class="brand-mark" aria-hidden="true">م</span><span>بوابة المجموعات<small>إدارة بسيطة للحسابات والمجموعات</small></span></button>',
  '    <nav class="header-nav" aria-label="التنقل"><button id="mainNav" type="button">الرئيسية</button><button id="groupsNav" type="button">المجموعات</button><button id="signInNav" type="button">تسجيل الدخول</button><button id="profileNav" type="button">الملف الشخصي</button></nav>',
  '    <div class="header-actions"><div class="notification-wrap"><button class="icon-button" id="notificationsButton" type="button" aria-label="الإشعارات">⌁<span class="notification-count hidden" id="notificationCount"></span></button><div class="notification-panel hidden" id="notificationPanel"></div></div><span class="hidden" id="headerIdentity"></span><button class="icon-button hidden" id="headerAvatar" type="button" aria-label="الملف الشخصي">م</button><button class="icon-button" id="refreshButton" type="button" aria-label="تحديث الصفحة">↻</button><button class="language-button" id="languageToggle" type="button">English</button><span class="local-note">نسخة تجريبية · تخزين محلي</span></div>',
  '  </header>',
].join('\n');

const FOOTER = '  <footer class="shell">Created by Youssef Mahmoud Shaban · WhatsApp: <a href="https://wa.me/201102734090" target="_blank" rel="noopener">01102734090</a></footer>';

function pageHtml(page, base, scriptSrc, title) {
  return [
    '<!DOCTYPE html>',
    '<html lang="ar" dir="rtl">',
    '<head>',
    '  <meta charset="UTF-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
    '  <meta name="theme-color" content="#f5f7f2">',
    '  <title>' + title + '</title>',
    '  <link rel="stylesheet" href="' + base + '/styles.css">',
    '</head>',
    '<body data-page="' + page + '" data-base="' + base + '">',
    HEADER,
    '  <main class="shell">',
    '    <section class="panel active" id="userPanel" role="region" aria-label="قسم المستخدم">',
    '      <div class="surface main-card" id="userContent"></div>',
    '    </section>',
    '  </main>',
    FOOTER,
    '',
    '  <script src="' + base + '/shared.js"></script>',
    '  <script src="' + scriptSrc + '"></script>',
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

const TITLES = {
  home: 'بوابة المجموعات',
  signin: 'تسجيل الدخول · بوابة المجموعات',
  register: 'إنشاء حساب · بوابة المجموعات',
  groups: 'المجموعات · بوابة المجموعات',
  profile: 'الملف الشخصي · بوابة المجموعات',
};

fs.writeFileSync(path.join(DIR, 'index.html'), pageHtml('home', '.', 'home/script.js', TITLES.home), 'utf8');
['signin', 'register', 'groups', 'profile'].forEach(name => {
  fs.writeFileSync(path.join(DIR, name, 'index.html'), pageHtml(name, '..', 'script.js', TITLES[name]), 'utf8');
});
console.log('wrote html pages');

console.log('BUILD OK');





