// Adds missing i18n dictionary entries. English text is declared below; the Arabic
// text is harvested from the page that uses the key, so wording stays consistent.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const I18N = path.join(ROOT, 'frontend', 'shared', 'i18n.js');
const FRONTEND = path.join(ROOT, 'frontend');

const EN = {
  'admin.accountsManage': 'Accounts management',
  'admin.accountsNote': 'Approve join requests, disable accounts, move them between groups, and reset passwords. Only the super admin changes roles or manages admin accounts.',
  'admin.accountList': 'Account list',
  'admin.roleHint': 'The admin role is available to the super admin only.',
  'admin.logNote': 'Every sign-in, security change, and admin action is recorded here.',
  'admin.dashLead': 'Live numbers, groups, and the latest activity in one place.',
  'admin.groupsManage': 'Group management',
  'admin.groupsNote': 'Create groups, rename them, and delete them together with their content.',
  'admin.groupList': 'Group list',
  'admin.newGroup': 'New group',
  'admin.recordList': 'Content list',
  'admin.newRecord': 'New content',
  'admin.siteData': 'Site information',
  'admin.siteDataNote': 'These values appear across the site and can be updated by admins.',
  'admin.eyebrow': 'Admin area',
  'admin.areaTitle': 'Admin sign-in',
  'admin.areaNote': 'Sign in with an account that holds admin permissions to open the control area.',
  'field.contents': 'Contents',
  'field.body': 'Content',
  'field.published': 'Published to students',
  'filter.all': 'All',
  'filter.auth': 'Sign-in',
  'filter.security': 'Security',
  'filter.admin': 'Admin',
  'filter.info': 'Information',
  'title.admin': 'Admin sign-in',
  'action.backPortal': 'Back to the portal',
  'action.changePassword': 'Change password',
  'profile.title': 'Profile',
  'profile.subtext': 'Account details and password.',
  'profile.details': 'Account details',
  'profile.changePassword': 'Change password',
  'profile.passwordHint': 'Other devices are signed out once the password changes.',
};

const walk = (dir, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
};

const source = fs.readFileSync(I18N, 'utf8');
const existing = new Set([...source.matchAll(/^  '([^']+)':/gm)].map((m) => m[1]));

const used = new Map();
for (const file of walk(FRONTEND)) {
  const html = fs.readFileSync(file, 'utf8');
  const pageTitle = /<title>([^<]*)<\/title>/.exec(html)?.[1]?.split('·')[0].trim() || '';
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  for (const match of html.matchAll(/<(\w+)[^>]*?\sdata-i18n(?:-[a-z]+)?="([^"]+)"[^>]*>([^<]*)/g)) {
    const [, tag, key, text] = match;
    if (!used.has(key)) used.set(key, { key, text: text.trim(), rel, tag, body: false });
  }
  for (const match of html.matchAll(/<body[^>]*\sdata-page-title="([^"]+)"/g)) {
    if (!used.has(match[1])) used.set(match[1], { key: match[1], text: pageTitle, rel, tag: 'title', body: true });
  }
}

const missing = [...used.keys()].filter((key) => !existing.has(key) && EN[key]).sort();
const noEnglish = [...used.keys()].filter((key) => !existing.has(key) && !EN[key]).sort();
const noArabic = missing.filter((key) => !used.get(key).text);

const escape = (value) => value.replace(/'/g, "\\'");
const block = missing
  .map((key) => `  '${key}': ['${escape(used.get(key).text)}', '${escape(EN[key])}'],`)
  .join('\n');

const start = source.indexOf('export const dictionary = {');
const end = source.indexOf('\n};', start);
if (start < 0 || end < 0) throw new Error('dictionary block not found');
fs.writeFileSync(I18N, `${source.slice(0, end)}\n${block}${source.slice(end)}`, 'utf8');

console.log(`added ${missing.length} keys: ${missing.join(', ')}`);
if (noArabic.length) console.log(`WARNING empty arabic: ${noArabic.join(', ')}`);
if (noEnglish.length) console.log(`WARNING no english mapping: ${noEnglish.join(', ')}`);
