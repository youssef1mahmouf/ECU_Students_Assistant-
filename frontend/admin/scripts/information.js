import { bootAdmin } from '/shared/admin-layout.js';
import { api } from '/shared/api.js';
import { showMessage, setBusy } from '/shared/ui.js';
import { t, serverText } from '/shared/i18n.js';

const session = await bootAdmin({ active: 'information' });

const fields = {
  title: document.getElementById('infoTitle'),
  tagline: document.getElementById('infoTagline'),
  about: document.getElementById('infoAbout'),
  notice: document.getElementById('infoNotice'),
  academicYear: document.getElementById('infoYear'),
};
const form = document.getElementById('infoForm');
const submitButton = form.querySelector('button[type="submit"]');

async function loadInfo() {
  const data = await api.getQuiet('/api/admin/info');
  const info = data?.info;
  if (!info) return showMessage('infoMessage', t('msg.dataLoadFailed'), 'error');
  for (const [key, input] of Object.entries(fields)) input.value = info[key] || '';
}

if (session) {
  await loadInfo();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setBusy(submitButton, true, t('msg.saving'));
    try {
      const payload = {};
      for (const [key, input] of Object.entries(fields)) payload[key] = input.value.trim();
      await api.put('/api/admin/info', payload);
      showMessage('infoMessage', t('msg.dataSaved'), 'success');
    } catch (error) {
      showMessage('infoMessage', serverText(error.message, { status: error.status }), 'error');
    } finally {
      setBusy(submitButton, false);
    }
  });
}
