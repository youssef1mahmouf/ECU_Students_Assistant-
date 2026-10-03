import { bootChrome } from '/shared/layout.js';
import { api } from '/shared/api.js';
import { escapeHtml, mount, showMessage, setBusy } from '/shared/ui.js';
import { requireSignIn } from '/shared/session.js';
import { t, serverText } from '/shared/i18n.js';

await bootChrome({ area: 'user', active: 'report' });
const session = await requireSignIn({ redirectTo: '/user/signin/' });

if (session) {
  /* The page the user came from is prefilled for them (and still editable). */
  const pageInput = document.getElementById('problemPage');
  if (!pageInput.value) {
    const from = new URLSearchParams(window.location.search).get('page') || document.referrer || '';
    try {
      pageInput.value = from ? new URL(from, window.location.origin).pathname : '/user/';
    } catch {
      pageInput.value = '/user/';
    }
  }

  const form = document.getElementById('problemForm');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const button = document.getElementById('problemSubmit');
    setBusy(button, true, t('msg.sending'));
    try {
      const result = await api.post('/api/user/problems', {
        category: String(data.get('category') || 'other'),
        page: String(data.get('page') || '').trim(),
        description: String(data.get('description') || '').trim(),
      });
      showMessage('problemMessage', result?.emailSent ? t('msg.reportEmailed') : t('msg.reportSavedNoEmail'), result?.emailSent ? 'success' : 'info');
      form.reset();
    } catch (error) {
      showMessage('problemMessage', serverText(error.message, { status: error.status }), 'error');
    } finally {
      setBusy(button, false);
    }
  });
}
