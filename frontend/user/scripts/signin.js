import { bootChrome } from '/shared/layout.js';
import { api } from '/shared/api.js';
import { showMessage, setBusy, toast } from '/shared/ui.js';
import { loadSession, safeNext } from '/shared/session.js';
import { t, serverText, onLanguageChange } from '/shared/i18n.js';

await bootChrome({ area: 'user', active: 'signin' });

const session = await loadSession({ force: true });
if (session.user) {
  /* Already signed in: send each role where it belongs rather than to the student profile. */
  window.location.replace(safeNext(session.permissions?.isAdmin ? '/admin/dashboard/' : '/user/profile/'));
}

const emailStep = document.getElementById('emailStep');
const passwordStep = document.getElementById('passwordStep');
const setupStep = document.getElementById('setupStep');
const emailField = document.getElementById('loginEmail');
const passwordField = document.getElementById('loginPassword');
const continueButton = document.getElementById('emailContinue');
const submitButton = document.getElementById('loginSubmit');
const signInAs = document.getElementById('signInAs');
const setupLink = document.getElementById('setupLink');

/** The last message shown, so a language switch repaints it instead of leaving old text. */
let notice = { text: t('msg.empty'), type: 'info' };
let checkedEmail = '';

function say(text, type = 'info') {
  notice = { text, type };
  showMessage('loginMessage', text, type);
}

function show(step) {
  emailStep.hidden = step !== 'email';
  passwordStep.hidden = step !== 'password';
  setupStep.hidden = step !== 'setup';
  signInAs.textContent = checkedEmail ? t('user.signInAs', { email: checkedEmail }) : '';
  setupLink.href = `/user/register/?email=${encodeURIComponent(checkedEmail)}`;
}

/* The client normalises for display only; the server normalises again before it looks
   anything up, and never trusts what the browser sent. */
function readEmail() {
  return String(emailField.value || '').trim().toLowerCase();
}

emailStep.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = readEmail();
  if (!email) {
    say(t('msg.emailRequired'), 'error');
    emailField.focus();
    return;
  }
  setBusy(continueButton, true, t('msg.busyChecking'));
  try {
    const answer = await api.post('/api/auth/check-email', { email });
    checkedEmail = email;
    if (!answer?.recognized) {
      say(t('server.notRegistered'), 'error');
      return;
    }
    if (answer.hasAccount) {
      show('password');
      say('');
      passwordField.focus();
      return;
    }
    show('setup');
    say(t('user.noPasswordYet'));
  } catch (error) {
    say(serverText(error.message, { status: error.status }), 'error');
  } finally {
    setBusy(continueButton, false);
  }
});

document.getElementById('changeEmail').addEventListener('click', () => {
  checkedEmail = '';
  passwordField.value = '';
  show('email');
  say('');
  emailField.focus();
});

passwordStep.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = checkedEmail || readEmail();
  const password = String(passwordField.value || '');
  if (!password) {
    say(t('msg.fillEmailAndPassword'), 'error');
    passwordField.focus();
    return;
  }
  setBusy(submitButton, true, t('msg.busySigningIn'));
  try {
    /* One sign-in page for every role: the server decides where this account belongs, and
       a staff account goes straight to the dashboard instead of the student profile. */
    const result = await api.post('/api/auth/login', {
      email,
      password,
      remember: new FormData(passwordStep).get('remember') === 'on',
    });
    toast(t('msg.signedIn'), 'success');
    const landing = result?.permissions?.isAdmin ? '/admin/dashboard/' : '/user/profile/';
    window.location.replace(safeNext(landing));
  } catch (error) {
    /* The server answers credential failures with one generic sentence on purpose. */
    say(serverText(error.message, { status: error.status }), 'error');
    setBusy(submitButton, false);
    passwordField.focus();
  }
});

onLanguageChange(() => {
  showMessage('loginMessage', notice.text, notice.type);
  signInAs.textContent = checkedEmail ? t('user.signInAs', { email: checkedEmail }) : '';
});

show('email');
if (window.location.search.includes('created=1')) say(t('server.accountCreatedPending'));
emailField.focus();
