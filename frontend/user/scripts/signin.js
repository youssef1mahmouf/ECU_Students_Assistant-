/**
 * /user/signin/ - one email-first sign-in form for every role.
 *
 * The two steps are two real <form> elements in the markup, not one form that is
 * reshaped by script, so each step has its own labels, its own focus target and
 * its own submit handling. The password field exists in the page but inside the
 * hidden step: the server has not yet said this address is known, so the browser
 * never offers a password it could not use.
 */
import { bootChrome } from '/shared/shell.js';
import { api, resetApiCache } from '/shared/api.js';
import { showMessage, setBusy, toast } from '/shared/ui.js';
import { loadSession, safeNext } from '/shared/session.js';
import { t, serverText, onLanguageChange } from '/shared/i18n.js';

await bootChrome({ area: 'user', active: 'signin' });

const session = await loadSession({ force: true });
if (session.user) {
  /* Already signed in: send each role where it belongs. */
  window.location.replace(safeNext(session.permissions?.isAdmin ? '/admin/dashboard/' : '/user/'));
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

/* Kept so a language switch repaints the last message instead of leaving it stale. */
let notice = { text: '', type: 'info' };
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

/* The client normalises for display only; the server normalises again before it
   looks anything up, and never trusts what the browser sent. */
const readEmail = () => String(emailField.value || '').trim().toLowerCase();

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
    /* One form for every role: the server decides where the account belongs and
       a staff account goes straight to the dashboard. */
    const result = await api.post('/api/auth/login', {
      email,
      password,
      remember: new FormData(passwordStep).get('remember') === 'on',
    });
    /* A new session means every cached read belongs to the previous one. */
    resetApiCache();
    toast(t('msg.signedIn'), 'success');
    window.location.replace(safeNext(result?.permissions?.isAdmin ? '/admin/dashboard/' : '/user/'));
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
