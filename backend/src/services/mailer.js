'use strict';
/**
 * Outbound email. One entry point, two providers, chosen by config.mail.provider:
 *
 *   resend   - the hosted API the project started with (default, unchanged behaviour).
 *   outlook  - Microsoft 365 / Outlook over the Graph API with an app registration
 *              (client credentials). It is a plain HTTPS call, so no mail library is
 *              added to the dependency list.
 *
 * Neither path ever throws a secret at the caller: configuration problems surface as a 503
 * with a generic message, and provider errors are logged, not echoed back to the browser.
 */

const config = require('../config/env');

const NOT_CONFIGURED = 'Email delivery is not configured.';

function notConfigured() {
  const error = new Error(NOT_CONFIGURED);
  error.status = 503;
  return error;
}

async function sendWithResend({ to, subject, text }) {
  if (!config.mail.apiKey || !config.mail.from) throw notConfigured();
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.mail.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: config.mail.from, to: [to], subject, text }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    const error = new Error(`Email provider returned HTTP ${response.status}.`);
    error.status = 502;
    throw error;
  }
  return { sent: true, provider: 'resend' };
}

/** Client-credentials token for the Graph API. Cached for its own lifetime only. */
let tokenCache = { value: '', expiresAt: 0 };

async function graphToken() {
  const { tenant, clientId, clientSecret } = config.mail.outlook;
  if (!tenant || !clientId || !clientSecret) throw notConfigured();
  if (tokenCache.value && tokenCache.expiresAt > Date.now()) return tokenCache.value;

  const response = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }),
      signal: AbortSignal.timeout(10000),
    }
  );
  if (!response.ok) {
    const error = new Error(`Outlook sign-in failed (HTTP ${response.status}).`);
    error.status = 502;
    throw error;
  }
  const payload = await response.json();
  // Refresh a minute early so a token cannot expire mid-send.
  tokenCache = { value: payload.access_token, expiresAt: Date.now() + Math.max((payload.expires_in - 60) * 1000, 30_000) };
  return tokenCache.value;
}

async function sendWithOutlook({ to, subject, text }) {
  const sender = config.mail.outlook.sender;
  if (!sender) throw notConfigured();
  const token = await graphToken();
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: 'Text', content: text },
          toRecipients: [{ emailAddress: { address: to } }],
        },
        saveToSentItems: false,
      }),
      signal: AbortSignal.timeout(15000),
    }
  );
  // Graph answers 202 with an empty body on success.
  if (!response.ok && response.status !== 202) {
    const error = new Error(`Outlook send failed (HTTP ${response.status}).`);
    error.status = 502;
    throw error;
  }
  return { sent: true, provider: 'outlook' };
}

async function sendEmail(payload) {
  if (config.mail.provider === 'outlook') return sendWithOutlook(payload);
  return sendWithResend(payload);
}

module.exports = { sendEmail, NOT_CONFIGURED };
