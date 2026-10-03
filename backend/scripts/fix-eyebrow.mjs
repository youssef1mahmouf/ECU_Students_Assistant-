// One-off repair: the codemod harvested an empty Arabic string for admin.eyebrow.
import fs from 'node:fs';

const file = 'frontend/shared/i18n.js';
const arabic = '\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0623\u062f\u0645\u0646';
const source = fs.readFileSync(file, 'utf8');
const updated = source.replace(/'admin\.eyebrow':\s*\[[^\]]*\]/, `'admin.eyebrow': ['${arabic}', 'Admin area']`);
if (updated === source) throw new Error('admin.eyebrow entry not found');
fs.writeFileSync(file, updated, 'utf8');
console.log('fixed admin.eyebrow');
