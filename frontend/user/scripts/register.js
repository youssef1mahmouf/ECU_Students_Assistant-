/**
 * /user/register/ - create the first password for a rostered address.
 *
 * Registration is closed: the server decides whether an address may create an
 * account at all. This page therefore does the least it can - send a code,
 * verify it, set a password - and takes nothing about the student's identity
 * from the browser. The name, student id and group come from the roster.
 */
import { bootChrome } from '/shared/shell.js';
import { api } from '/shared/api.js';
import { showMessage, setBusy, toast } from '/shared/ui.js';
import { t, serverText, onLanguageChange } from '/shared/i18n.js';

await bootChrome({ area: 'user', active: 'register' });

const form = document.getElementById('registerForm');
const emailField = document.getElementById('newEmail');
const passwordField = document.getElementById('newPassword');
const confirmField = document.getElementById('newPasswordConfirm');
const submitButton = document.getElementById('registerSubmit');
const codeField = document.getElementById('emailCode');
const sendCodeButton = document.getElementById('sendCode');
const verifyCodeButton = document.getElementById('verifyCode');
const codeStep = document.getElementById('codeStep');
const passwordStep = document.getElementById('passwordStep');
const confirmStep = document.getElementById('confirmStep');

let verifiedEmail = '';

/* Arriving from the sign-in page carries the address that was just recognised. */
const prefilled = new URLSearchParams(window.location.search).get('email');
if (prefilled) emailField.value = prefilled.trim().toLowerCase();

let notice = { text: '', type: 'info' };
function say(text, type = 'info') {
  notice = { text, type };
  showMessage('registerMessage', text, type);
}

/**
 * Client-side hints only. The server repeats every one of these checks and takes
 * the name, student id and group from the approved roster - never from this form.
 */
function problem(values) {
  const email = String(values.email || '').trim().toLowerCase();
  if (!email) return t('msg.emailRequired');
  if (!email.includes('@') || email.startsWith('@') || email.endsWith('@')) {
    return t('v.invalid', { field: t('field.email') });
  }
  const secret = String(values.password || '');
  if (secret.length < 8) return t('msg.passwordTooShort');
  if (!/(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])/.test(secret)) return t('msg.passwordPolicy');
  if (secret !== String(values.passwordConfirm || '')) return t('msg.passwordMismatch');
  return '';
}

/** The code and password steps only exist once an address has been accepted. */
function revealFrom(step) {
  codeStep.hidden = step !== 'code';
  const showPassword = step === 'password';
  passwordStep.hidden = !showPassword;
  confirmStep.hidden = !showPassword;
}

emailField.addEventListener('input', () => {
  if (verifiedEmail && verifiedEmail !== emailField.value.trim().toLowerCase()) verifiedEmail = '';
});

sendCodeButton.addEventListener('click', async () => {
  const email = emailField.value.trim().toLowerCase();
  if (!email) return say(t('msg.emailRequired'), 'error');
  setBusy(sendCodeButton, true, t('msg.sending'));
  try {
    await api.post('/api/auth/send-code', { email });
    revealFrom('code');
    say(t('msg.codeSent'), 'success');
    codeField.focus();
  } catch (error) {
    say(serverText(error.message, { status: error.status }), 'error');
  } finally {
    setBusy(sendCodeButton, false);
  }
});

verifyCodeButton.addEventListener('click', async () => {
  const email = emailField.value.trim().toLowerCase();
  const code = codeField.value.trim();
  if (!email) return say(t('msg.emailRequired'), 'error');
  if (!/^\d{6}$/.test(code)) return say(t('msg.codeRequired'), 'error');

  setBusy(verifyCodeButton, true, t('msg.checking'));
  try {
    await api.post('/api/auth/verify-code', { email, code });
    verifiedEmail = email;
    revealFrom('password');
    say(t('msg.codeVerified'), 'success');
    passwordField.focus();
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
  if (firstProblem) return say(firstProblem, 'error');

  const email = String(values.email).trim().toLowerCase();
  if (verifiedEmail !== email) return say(t('msg.verifyEmailFirst'), 'error');

  setBusy(submitButton, true, t('msg.busyCreating'));
  try {
    await api.post('/api/auth/register', { email, password: values.password });
    toast(t('msg.accountCreatedPending'), 'success');
    window.location.replace('/user/signin/?created=1');
  } catch (error) {
    say(serverText(error.message, { status: error.status }), 'error');
    setBusy(submitButton, false);
  }
});

onLanguageChange(() => showMessage('registerMessage', notice.text, notice.type));

revealFrom('code');
emailField.focus();
