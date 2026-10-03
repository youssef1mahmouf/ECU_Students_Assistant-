import { bootChrome } from '/shared/layout.js';
import { api } from '/shared/api.js';
import { showMessage, setBusy, toast } from '/shared/ui.js';
import { t, serverText, onLanguageChange } from '/shared/i18n.js';

/* The join page shows the public nav, so Home opens the landing page as a visitor sees it
   instead of the student area. */
await bootChrome({ area: 'user', active: 'register', preview: true });

const form = document.getElementById('registerForm');
const emailField = document.getElementById('newEmail');
const passwordField = document.getElementById('newPassword');
const confirmField = document.getElementById('newPasswordConfirm');
const submitButton = document.getElementById('registerSubmit');
const codeField = document.getElementById('emailCode');
const sendCodeButton = document.getElementById('sendCode');
const verifyCodeButton = document.getElementById('verifyCode');
let verifiedEmail = '';

/* Arriving from the sign-in page carries the address that was just recognised. */
const prefilled = (window.location.search.match(/email=([^&]+)/) || [])[1];
if (prefilled) emailField.value = decodeURIComponent(prefilled).trim().toLowerCase();

let notice = { text: '', type: 'info' };
function say(text, type = 'info') {
  notice = { text, type };
  showMessage('registerMessage', text, type);
}

/* Client-side hints only. The server repeats every one of these checks, and takes the
   name, the student id and the group from the approved roster - never from this form. */
function problem(values) {
  const email = String(values.email || '').trim().toLowerCase();
  if (!email) return t('msg.emailRequired');
  if (!email.includes('@') || email.startsWith('@') || email.endsWith('@')) return t('v.invalid', { field: t('field.email') });
  const secret = String(values.password || '');
  if (secret.length < 8) return t('msg.passwordTooShort');
  if (!/(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])/.test(secret)) return t('msg.passwordPolicy');
  if (secret !== String(values.passwordConfirm || '')) return t('msg.passwordMismatch');
  return '';
}

emailField.addEventListener('input', () => { verifiedEmail = ''; });

sendCodeButton.addEventListener('click', async () => {
  const email = String(emailField.value || '').trim().toLowerCase();
  if (!email) return say(t('msg.emailRequired'), 'error');
  setBusy(sendCodeButton, true, t('msg.sending'));
  try {
    await api.post('/api/auth/send-code', { email });
    say(t('msg.codeSent'), 'success');
    codeField.focus();
  } catch (error) {
    say(serverText(error.message, { status: error.status }), 'error');
  } finally {
    setBusy(sendCodeButton, false);
  }
});

verifyCodeButton.addEventListener('click', async () => {
  const email = String(emailField.value || '').trim().toLowerCase();
  const code = String(codeField.value || '').trim();
  if (!email) return say(t('msg.emailRequired'), 'error');
  if (!/^\d{6}$/.test(code)) return say(t('msg.codeRequired'), 'error');
  setBusy(verifyCodeButton, true, t('msg.checking'));
  try {
    await api.post('/api/auth/verify-code', { email, code });
    verifiedEmail = email;
    say(t('msg.codeVerified'), 'success');
  } catch (error) {
    verifiedEmail = '';
    say(serverText(error.message, { status: error.status }), 'error');
  } finally {
    setBusy(verifyCodeButton, false);
  }
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(form).entries());
  const firstProblem = problem(values);
  if (firstProblem) {
    say(firstProblem, 'error');
    return;
  }
  if (verifiedEmail !== String(values.email).trim().toLowerCase()) {
    say(t('msg.verifyEmailFirst'), 'error');
    return;
  }
  setBusy(submitButton, true, t('msg.busyCreating'));
  try {
    await api.post('/api/auth/register', {
      email: String(values.email).trim().toLowerCase(),
      password: values.password,
    });
    toast(t('msg.accountCreatedPending'), 'success');
    window.location.replace('/user/signin/?created=1');
  } catch (error) {
    say(serverText(error.message, { status: error.status }), 'error');
    setBusy(submitButton, false);
  }
});

onLanguageChange(() => showMessage('registerMessage', notice.text, notice.type));

emailField.focus();
