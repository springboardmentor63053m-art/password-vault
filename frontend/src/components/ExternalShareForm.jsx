import React, { useEffect, useState } from 'react';
import { vaultRequest } from '../services/vaultApi';

const endpoint = '/shares/external';
const durations = [[15, '15 minutes'], [60, '1 hour'], [1440, '24 hours'], [10080, '7 days']];
const statusLabel = status => status.toLowerCase().replaceAll('_', ' ');

export default function ExternalShareForm({ items, refreshHistory, onSaved }) {
  const [feedback, setFeedback] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    setBusy(true);
    setFeedback(null);
    try {
      await vaultRequest(endpoint, { method: 'POST', body: JSON.stringify({
        credentialId: fields.get('credentialId'), email: fields.get('email').trim(),
        minutes: Number(fields.get('minutes')), oneTime: fields.has('oneTime'), message: fields.get('message').trim(),
      }) });
      form.reset();
      setFeedback({ text: 'Secure access link sent successfully.' });
    } catch (error) {
      setFeedback({ error: true, text: error.message });
    } finally {
      onSaved();
      void refreshHistory();
      setBusy(false);
    }
  }

  return (
    <form className="sv-share-form external-share-form" onSubmit={submit}>
      <label className="sv-field">Stored credential<select name="credentialId" required defaultValue="">
        <option value="">Select your credential</option>
        {items.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
      </select></label>
      <label className="sv-field">Recipient email<input name="email" type="email" required maxLength={254} /></label>
      <label className="sv-field">Access expires after<select name="minutes">
        {durations.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
      </select></label>
      <label className="sv-field">Message (optional, no sensitive details)<input name="message" maxLength={240} /></label>
      <label><input type="checkbox" name="oneTime" /> One-time credential retrieval</label>
      <div className="sv-permission"><span className="sv-status active">View Only</span>
        <p>The email contains a temporary link. The recipient verifies their email before accessing the credential.</p></div>
      {feedback && <div className={'sv-permission sv-feedback ' + (feedback.error ? 'sv-error' : 'sv-success')}
        role={feedback.error ? 'alert' : 'status'}>
        <p>{feedback.text}{!feedback.error && ' The SMTP server accepted the message. Inbox delivery may take longer.'}</p>
      </div>}
      <div className="sv-footer"><button className="sv-button sv-primary" disabled={busy}>{busy ? 'Submitting…' : 'Send Secure Access Link'}</button></div>
    </form>
  );
}

export function ExternalSent({ items, revision, onChanged }) {
  const [shares, setShares] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('ALL');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let current = true;
    vaultRequest(endpoint).then(rows => {
      if (current) { setShares(Array.isArray(rows) ? rows : []); setError(''); }
    }).catch(failure => { if (current) setError(failure.message); });
    return () => { current = false; };
  }, [revision]);

  async function revoke(id) {
    if (!window.confirm('Revoke future access? This cannot erase anything the recipient already viewed or copied.')) return;
    setBusy(true);
    setError('');
    try { await vaultRequest(endpoint + '/' + id, { method: 'DELETE' }); onChanged(); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }

  const shown = shares?.filter(share => status === 'ALL' || share.status === status);
  return (
    <section className="sv-external-sent">
      <header className="sv-heading"><div><h2>External shares</h2><p>Invitations sent to email addresses.</p></div></header>
      {error && <p role="alert" className="sv-feedback sv-error">{error}</p>}
      {!shares && !error && <p role="status">Loading external shares…</p>}
      {!!shares?.length && <label className="sv-field">External share status<select value={status} onChange={event => setStatus(event.target.value)}>
        {['ALL', 'PENDING_VERIFICATION', 'ACTIVE', 'EXPIRED', 'REVOKED', 'CONSUMED', 'DELIVERY_FAILED'].map(value =>
          <option value={value} key={value}>{statusLabel(value)}</option>)}
      </select></label>}
      {shown?.length === 0 && <p className="sv-empty">No matching external shares.</p>}
      <div className="sv-list">{shown?.map(share => (
        <article className="sv-row" key={share.id}>
          <div className="sv-row-heading"><div><small>External · View Only</small><h3>{items.find(item => item.id === share.credentialId)?.title || share.credentialId}</h3></div>
            <span className={'sv-status ' + share.status.toLowerCase()}>{statusLabel(share.status)}</span></div>
          <dl className="sv-share-details">
            <div><dt>Recipient</dt><dd>{share.recipient}</dd></div>
            <div><dt>Shared</dt><dd>{new Date(share.createdAt).toLocaleString()}</dd></div>
            <div><dt>Expires</dt><dd>{new Date(share.expiresAt).toLocaleString()}</dd></div>
            <div><dt>Access</dt><dd>{share.oneTime ? 'One-time' : 'Repeatable with email verification'}</dd></div>
          </dl>
          {['ACTIVE', 'PENDING_VERIFICATION'].includes(share.status) && <div className="sv-share-actions">
            <button type="button" className="sv-button sv-danger" disabled={busy} onClick={() => revoke(share.id)}>Revoke External Access</button>
          </div>}
        </article>
      ))}</div>
    </section>
  );
}
