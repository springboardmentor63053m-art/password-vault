import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../components/SecurityWorkspace.css';
import './external.css';

const token = window.location.hash.slice(1);
window.history.replaceState(null, '', window.location.pathname);
const validLink = /^[A-Za-z0-9_-]{43}$/.test(token);

async function request(action, fields = {}) {
  const response = await fetch('/api/external-shares/' + action, {
    method: 'POST', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, ...fields }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.message || 'Secure access is unavailable.');
  return body;
}

function ExternalAccess() {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(validLink ? '' : 'Invalid secure access link.');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [grant, setGrant] = useState('');
  const [item, setItem] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (validLink) request('inspect').then(setInfo).catch(failure => setError(failure.message));
    const clear = () => { setItem(null); setGrant(''); setCode(''); setVisible(false); setInfo(null); };
    window.addEventListener('pagehide', clear);
    return () => window.removeEventListener('pagehide', clear);
  }, []);

  async function action(work) {
    setBusy(true);
    setError('');
    setNotice('');
    try { await work(); }
    catch (failure) { setError(failure.message || 'Secure access is unavailable.'); }
    finally { setBusy(false); }
  }

  return (
    <main className="sv-settings external-access">
      <section className="sv-card">
        <header className="sv-heading"><div><p>SecureVault</p><h1>Shared credential</h1></div></header>
        {info && <p>Access expires {new Date(info.expiresAt).toLocaleString()}. {info.oneTime && 'This link allows one retrieval.'}</p>}
        {error && <p className="sv-feedback sv-error" role="alert">{error}</p>}
        {notice && <p className="sv-feedback sv-success" role="status">{notice}</p>}
        {!info && !error && !notice && <p role="status">Checking secure link…</p>}
        {info && <div className="external-steps">
          {!grant && !item && <>
            <p>Verify access to the email address that received this invitation.</p>
            <button className="sv-button" disabled={busy} onClick={() => action(async () => {
              await request('code'); setSent(true); setNotice('Verification code submitted to the mail server.');
            })}>{sent ? 'Resend code' : 'Send verification code'}</button>
            {sent && <form onSubmit={event => {
              event.preventDefault();
              void action(async () => { const result = await request('verify', { code }); setCode(''); setGrant(result.grant); });
            }}>
              <label className="sv-field">Six-digit code<input required pattern="[0-9]{6}" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={event => setCode(event.target.value)} /></label>
              <button className="sv-button sv-primary" disabled={busy}>Verify email</button>
            </form>}
          </>}
          {grant && !item && <button className="sv-button sv-primary" disabled={busy} onClick={() => action(async () => {
            try {
              const credential = await request('retrieve', { grant });
              setItem(credential);
            } finally {
              setGrant('');
            }
          })}>Retrieve credential</button>}
          {item && <section className="sv-row">
            <h2>{item.title}</h2>
            {item.username && <p>Username · {item.username}</p>}
            {item.url && <p>Website · {item.url}</p>}
            <p>Password · <code>{visible ? item.password : '••••••••••••'}</code></p>
            <div className="sv-password-actions">
              <button className="sv-button" onClick={() => setVisible(value => !value)}>{visible ? 'Hide Password' : 'Reveal Password'}</button>
              <button className="sv-button" disabled={busy} onClick={() => action(async () => {
                await navigator.clipboard.writeText(item.password); setNotice('Password copied.');
              })}>Copy Password</button>
              <button className="sv-button" onClick={() => { setItem(null); setVisible(false); setInfo(null); setNotice('Credential closed.'); }}>Close</button>
            </div>
          </section>}
        </div>}
        <p className="external-security-note">Keep the invitation and verification code private. Only retrieve credentials you were expecting.</p>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<ExternalAccess />);
