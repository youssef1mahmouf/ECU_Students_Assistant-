/**
 * /user/report/ - report a problem in the portal.
 *
 * This is the "AUSH"-shaped part of the student area: the one place a student
 * asks for help, and the one place the answer comes back through
 * /admin/problems/. It is a normal form with the same loading / saving / saved /
 * error vocabulary as every other page, not a separate visual language.
 */
import { bootChrome } from '/shared/shell.js';
import { api } from '/shared/api.js';
import { showMessage, setBusy, toast } from '/shared/ui.js';
import { requireSignIn } from '/shared/session.js';
import { t, serverText } from '/shared/i18n.js';

await bootChrome({ area: 'user', active: 'support' });

const session = await requireSignIn({ redirectTo: '/user/signin/' });
if (!session) throw new Error('redirecting');

/* The page the user came from is prefilled, and still editable. */
const pageInput = document.getElementById('problemPage');
const from = new URLSearchParams(window.location.search).get('page') || document.referrer || '';
try {
  pageInput.value = from ? new URL(from, window.location.origin).pathname : '/user/';
} catch {
  pageInput.value = '/user/';
}

const description = document.getElementById('problemDescription');
const counter = document.getElementById('problemCount');
description.addEventListener('input', () => { counter.textContent = String(description.value.length); });

const form = document.getElementById('problemForm');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const button = document.getElementById('problemSubmit');

  setBusy(button, true, t('msg.sending'));
  showMessage('problemMessage', '');
  try {
    const result = await api.post('/api/user/problems', {
      category: String(data.get('category') || 'other'),
      page: String(data.get('page') || '').trim(),
      description: String(data.get('description') || '').trim(),
    });
    const sent = result?.emailSent;
    form.reset();
    counter.textContent = '0';
    showMessage('problemMessage', sent ? t('msg.reportEmailed') : t('msg.reportSavedNoEmail'), sent ? 'success' : 'info');
    toast(sent ? t('msg.reportEmailed') : t('msg.reportSavedNoEmail'), sent ? 'success' : 'info');
  } catch (error) {
    showMessage('problemMessage', serverText(error.message, { status: error.status }), 'error');
  } finally {
    setBusy(button, false);
  }
});
