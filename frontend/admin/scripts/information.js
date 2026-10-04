/** /admin/information/ - the site copy shown on the public pages. */
import { bootAdmin } from '/shared/admin-layout.js';
import { api, invalidateApi } from '/shared/api.js';
import { showMessage, setBusy, toast } from '/shared/ui.js';
import { t, serverText } from '/shared/i18n.js';

const session = await bootAdmin({ active: 'information' });
if (!session) throw new Error('redirecting');

const form = document.getElementById('infoForm');
const FIELDS = {
  infoTitle: 'title',
  infoTagline: 'tagline',
  infoYear: 'academicYear',
  infoNotice: 'notice',
  infoAbout: 'about',
};

function paint(info) {
  for (const [id, key] of Object.entries(FIELDS)) {
    const input = document.getElementById(id);
    if (input) input.value = info?.[key] || '';
  }
  const lead = document.getElementById('infoLead');
  if (lead) lead.textContent = t('admin.siteDataNote');
}

try {
  paint(await api.get('/api/admin/info'));
} catch (error) {
  showMessage('infoMessage', serverText(error.message, { status: error.status }), 'error');
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = form.querySelector('button[type="submit"]');
  const payload = Object.fromEntries(Object.entries(FIELDS).map(([id, key]) => [key, document.getElementById(id).value]));

  setBusy(button, true, t('msg.saving'));
  showMessage('infoMessage', '');
  try {
    const result = await api.put('/api/admin/info', payload);
    /* The public pages read /api/public/site, so that read is now stale. */
    invalidateApi(['/api/public/site', '/api/admin/info']);
    paint(result.info || payload);
    showMessage('infoMessage', t('msg.saved'), 'success');
    toast(t('msg.saved'), 'success');
  } catch (error) {
    showMessage('infoMessage', serverText(error.message, { status: error.status }), 'error');
  } finally {
    setBusy(button, false);
  }
});
