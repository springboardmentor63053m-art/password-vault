import React, { useEffect, useRef, useState } from 'react';
import { vaultApi, vaultRequest } from '../services/vaultApi';
import './SecurityWorkspace.css';
import ExternalShareForm, { ExternalSent } from './ExternalShareForm';
export const shareApi = {
  sent:()=>vaultRequest('/shares/sent'), received:()=>vaultRequest('/shares/received'), history:()=>vaultRequest('/shares/history'),
  recipients:search=>vaultRequest(`/shares/recipients?${new URLSearchParams({search})}`),
  create:body=>vaultRequest('/shares',{method:'POST',body:JSON.stringify(body)}),
  revoke:id=>vaultRequest(`/shares/${id}`,{method:'DELETE'}),
  expiry:(id,expiresAt)=>vaultRequest(`/shares/${id}/expiry`,{method:'PATCH',body:JSON.stringify({expiresAt})}),
  read:id=>vaultRequest(`/shares/${id}/credential`),
};
const localTime=value=>value?new Date(new Date(value).getTime()-new Date(value).getTimezoneOffset()*60000).toISOString().slice(0,16):'';
const historyActions = {
  EXTERNAL_SHARE_CREATED: ['External share created', 'fa-share-nodes'],
  EXTERNAL_INVITATION_SUBMITTED: ['Invitation submitted to SMTP', 'fa-envelope'],
  EXTERNAL_DELIVERY_FAILED: ['Email submission failed', 'fa-circle-exclamation'],
  EXTERNAL_RECIPIENT_VERIFIED: ['Recipient verified', 'fa-check'],
  EXTERNAL_CREDENTIAL_ACCESSED: ['Credential accessed', 'fa-key'],
  EXTERNAL_SHARE_CONSUMED: ['One-time share consumed', 'fa-check'],
  EXTERNAL_SHARE_REVOKED: ['External access revoked', 'fa-user-slash'],
  CREDENTIAL_SHARED: ['Credential shared', 'fa-share-nodes'],
  CREDENTIAL_SHARE_DENIED: ['Sharing denied', 'fa-ban'],
  SHARE_REVOKED: ['Access revoked', 'fa-user-slash'],
  SHARE_PERMISSION_CHANGED: ['Share expiry updated', 'fa-calendar-check'],
  SHARE_EXPIRED: ['Access expired', 'fa-hourglass-end'],
};
const shareDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function ShareDate({ value }) {
  return <time dateTime={value}>{shareDate.format(new Date(value))}</time>;
}

function ShareState({ state, empty, label, emptyText, retry }) {
  if (state.error) return (
    <div className="sv-empty sv-share-state">
      <p role="alert"><strong>Could not load {label}.</strong> {state.error}</p>
      <button type="button" className="sv-button" onClick={retry}>Try again</button>
    </div>
  );
  if (!state.loaded) return <p className="sv-empty" role="status">Loading {label}…</p>;
  if (empty) return <p className="sv-empty">{emptyText}</p>;
  return null;
}

export default function SecureShare(){
 const [tab,setTab]=useState('sent');
 const [external,setExternal]=useState(false);
 const [externalRevision,setExternalRevision]=useState(0);
 const refreshExternal=()=>setExternalRevision(value=>value+1);
 const [records,setRecords]=useState({sent:{},received:{},history:{}});
 const [sent,setSent]=useState([]),[received,setReceived]=useState([]),[history,setHistory]=useState([]),[items,setItems]=useState([]);
 const [credential,setCredential]=useState(''),[search,setSearch]=useState(''),[matches,setMatches]=useState([]),[recipient,setRecipient]=useState(''),[expires,setExpires]=useState('');
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[detail,setDetail]=useState(null),[show,setShow]=useState(false),[opening,setOpening]=useState(null),[edits,setEdits]=useState({});
 const readVersion = useRef(0);
 const revealButton = useRef(null);

 async function load() {
   const requests = [
     ['sent', () => Promise.all([shareApi.sent(), vaultApi.list()]), ([shares, credentials]) => { setSent(shares); setItems(credentials); }],
     ['received', shareApi.received, setReceived],
     ['history', shareApi.history, setHistory],
   ];
   await Promise.all(requests.map(async ([id, request, save]) => {
     setRecords(current => ({ ...current, [id]: {} }));
     try {
       save(await request());
       setRecords(current => ({ ...current, [id]: { loaded: true } }));
     } catch (failure) {
       setRecords(current => ({ ...current, [id]: { error: failure.message || 'Try again in a moment.' } }));
     }
   }));
 }

 function closeCredential() {
   readVersion.current += 1;
   setDetail(null);
   setShow(false);
   setOpening(null);
 }

 async function openCredential(share) {
   closeCredential();
   const version = readVersion.current;
   setOpening(share.id);
   setError('');
   setNotice('');
   try {
     const credential = await shareApi.read(share.id);
     if (version === readVersion.current) setDetail({ shareId: share.id, expiresAt: share.expiresAt, credential });
   } catch (failure) {
     if (version === readVersion.current) setError(failure.message);
   } finally {
     if (version === readVersion.current) setOpening(null);
   }
 }

 async function copyPassword(password) {
   const version = readVersion.current;
   setError('');
   setNotice('');
   try {
     await navigator.clipboard.writeText(password);
     if (version === readVersion.current) setNotice('Shared password copied.');
   } catch {
     if (version === readVersion.current) setError('Clipboard access unavailable.');
   }
 }

 useEffect(() => {
   void load();
   return () => { readVersion.current += 1; };
 }, []);

 useEffect(() => {
   if (!detail) return;
   revealButton.current?.focus();
   const remaining = detail.expiresAt ? new Date(detail.expiresAt).getTime() - Date.now() : 30000;
   const timer = setTimeout(closeCredential, Math.max(0, Math.min(30000, remaining)));
   return () => clearTimeout(timer);
 }, [detail]);

 async function action(work, message) {
   setBusy(true);
   setError('');
   setNotice('');
   try {
     await work();
     closeCredential();
     await load();
     setNotice(message);
   } catch (failure) {
     setError(failure.message);
   } finally {
     setBusy(false);
   }
 }
 return <div className="sv-settings sv-sharing"><nav className="sharing-tabs" role="tablist" aria-label="Sharing sections">{[["sent","Shared by Me"],["received","Shared with Me"],["history","Sharing History"]].map(([id,label],index)=><button type="button" role="tab" key={id} id={`share-tab-${id}`} aria-selected={tab===id} aria-controls={`share-panel-${id}`} tabIndex={tab===id?0:-1} onClick={()=>{if(tab!==id){closeCredential();setError('');setNotice('');setTab(id);}}} onKeyDown={e=>{let next;if(e.key==="ArrowRight")next=(index+1)%3;else if(e.key==="ArrowLeft")next=(index+2)%3;else if(e.key==="Home")next=0;else if(e.key==="End")next=2;else return;e.preventDefault();e.currentTarget.parentElement.children[next].click();e.currentTarget.parentElement.children[next].focus();}}>{label}</button>)}</nav>{error&&<p role="alert" className="sv-feedback sv-error">{error}</p>}{notice&&<p role="status" className="sv-feedback sv-success">{notice}</p>}
  <section className="sv-card sv-compose" hidden={tab!=="sent"}><header className="sv-heading"><span className="sv-icon" aria-hidden="true"><i className="fa-solid fa-share-nodes"/></span><div><h2>Share a credential</h2><p>Send view-only access to one registered recipient.</p></div></header>

   <div className="sv-inline" role="group" aria-label="Sharing method">
     <button type="button" className="sv-button" aria-pressed={!external} onClick={() => setExternal(false)}>Share with Registered User</button>
     <button type="button" className="sv-button" aria-pressed={external} onClick={() => setExternal(true)}>Share with External Recipient</button>
   </div>
   {external && <ExternalShareForm items={items} refreshHistory={load} onSaved={refreshExternal} />}
   <form hidden={tab!=="sent" || external} className="sv-share-form" onSubmit={e=>{e.preventDefault();action(()=>shareApi.create({credentialId:credential,recipientId:recipient,expiresAt:expires?new Date(expires).toISOString():null}),'Credential shared with View Only access.');}}>
    <label className="sv-field">Stored credential<select aria-label="Stored credential to share" required value={credential} onChange={e=>setCredential(e.target.value)}><option value="">Select your credential</option>{items.map(i=><option key={i.id} value={i.id}>{i.title}</option>)}</select></label>
    <div className="sv-recipient-search"><label className="sv-field">Exact recipient username or email<input aria-label="Exact recipient username or email" minLength={3} maxLength={120} value={search} onChange={e=>{setSearch(e.target.value);setRecipient('');setMatches([]);}}/></label>
    <button className="sv-button" type="button" disabled={busy||search.trim().length<3} onClick={async()=>{try{const results=await shareApi.recipients(search);setMatches(results);setError('');setNotice(results.length?'Recipient found. Confirm the account below.':'No matching recipient. Check the exact username or email.');}catch(e){setError(e.message);}}}>Search recipient</button></div>
    <label className="sv-field">Registered recipient<select aria-label="Registered recipient" required value={recipient} onChange={e=>setRecipient(e.target.value)}><option value="">Select recipient</option>{matches.map(r=><option key={r.id} value={r.id}>{r.username}</option>)}</select></label>
    <label className="sv-field">Access expires (optional)<input aria-label="Share expiry" type="datetime-local" value={expires} onChange={e=>setExpires(e.target.value)}/></label>
    <div className="sv-permission"><span className="sv-status active">View Only</span><p>Access starts immediately. The recipient can read and copy the credential, including notes. Revoking access cannot remove copies they already made.</p></div><div className="sv-footer"><button className="sv-button sv-primary" disabled={busy}>Share credential</button></div>
   </form></section>

  <section className="sv-card" role="tabpanel" id="share-panel-sent" aria-labelledby="share-tab-sent" hidden={tab!=="sent"}>
    <header className="sv-heading"><div><h2>Shared by Me</h2><p>Review recipients and manage their access.</p></div><span className="sv-count">{sent.length}</span></header>
    <ShareState state={records.sent} empty={!sent.length} label="outgoing shares" emptyText="No outgoing shares. Use the form above to share a credential." retry={load} />
    <div className="sv-list">{records.sent.loaded&&sent.map(s=>{
      const expiry=edits[s.id]??localTime(s.expiresAt);
      return <article className="sv-row sv-share-row" key={s.id}>
        <div className="sv-row-heading"><span className="sv-icon" aria-hidden="true"><i className="fa-solid fa-user"/></span><div><small>Recipient</small><h3>To {s.recipient}</h3></div><span className={`sv-status ${s.status.toLowerCase()}`}>{s.status.toLowerCase()}</span></div>
        <dl className="sv-share-details">
          <div><dt>Credential</dt><dd>{items.find(item=>item.id===s.credentialId)?.title ?? s.credentialId}</dd></div>
          <div><dt>Access level</dt><dd>View Only</dd></div>
          <div><dt>Expires</dt><dd>{s.expiresAt?new Date(s.expiresAt).toLocaleString():'No expiry'}</dd></div>
        </dl>
        {s.status==='ACTIVE'&&<div className="sv-share-actions">
          <label className="sv-field">New expiry<input aria-label={`New expiry for ${s.recipient}`} type="datetime-local" value={expiry} onChange={e=>setEdits({...edits,[s.id]:e.target.value})}/></label>
          <button className="sv-button" disabled={busy} onClick={()=>action(()=>shareApi.expiry(s.id,expiry?new Date(expiry).toISOString():null),'Share expiry updated.')}>Update expiry</button>
          <button className="sv-button sv-danger" disabled={busy} onClick={()=>{if(window.confirm('Revoke this recipient’s future access?'))action(()=>shareApi.revoke(s.id),'Shared access revoked.');}}>Revoke access</button>
        </div>}
      </article>;
    })}</div>
    <ExternalSent items={items} revision={externalRevision} onChanged={()=>{refreshExternal();void load();}} />
  </section>
  <section className="sv-card" role="tabpanel" id="share-panel-received" aria-labelledby="share-tab-received" hidden={tab!=='received'}>
    <header className="sv-heading">
      <span className="sv-icon" aria-hidden="true"><i className="fa-solid fa-inbox" /></span>
      <div><h2>Shared with Me</h2><p>Credentials other people have shared with you.</p></div>
      {records.received.loaded && <span className="sv-count">{received.length}</span>}
    </header>
    <ShareState state={records.received} empty={!received.length} label="received shares" emptyText="No received shares." retry={load} />
    {records.received.loaded && received.length > 0 && (
      <div className="sv-list">
        {received.map(share => {
          const opened = detail?.shareId === share.id;
          return (
            <article className="sv-row sv-received-card" key={share.id}>
              <div className="sv-row-heading">
                <span className="sv-icon" aria-hidden="true"><i className="fa-solid fa-key" /></span>
                <div>
                  <small>Received credential</small>
                  <h3>{opened ? detail.credential.title : share.credentialName || 'Shared credential'}</h3>
                  <p>From {share.owner}</p>
                </div>
                <span className={'sv-status ' + share.status.toLowerCase()}>{share.status.toLowerCase()}</span>
              </div>
              <dl className="sv-share-details">
                {share.credentialId && <div><dt>Credential reference</dt><dd className="sv-reference">{share.credentialId}</dd></div>}
                {share.permission && <div><dt>Permission</dt><dd>{share.permission === 'VIEW' ? 'View Only' : share.permission}</dd></div>}
                <div><dt>Expires</dt><dd>{share.expiresAt ? <ShareDate value={share.expiresAt} /> : 'No expiry'}</dd></div>
              </dl>
              {share.status === 'ACTIVE' && !opened && (
                <div className="sv-share-actions">
                  <button type="button" className="sv-button" disabled={busy || opening === share.id}
                    onClick={() => openCredential(share)}>
                    <i className="fa-solid fa-lock" aria-hidden="true" />
                    {opening === share.id ? 'Opening credential…' : 'View shared credential'}
                  </button>
                </div>
              )}
              {opened && (
                <section className="sv-credential-detail" aria-label="Shared credential details">
                  <dl className="sv-share-details">
                    {detail.credential.username && <div><dt>Username</dt><dd>{detail.credential.username}</dd></div>}
                    {detail.credential.url && <div><dt>Website</dt><dd>{detail.credential.url}</dd></div>}
                    {detail.credential.notes && <div className="sv-credential-notes"><dt>Notes</dt><dd>{detail.credential.notes}</dd></div>}
                  </dl>
                  <div className="sv-password-area">
                    <div className="sv-password-value"><span>Password</span><code>{show ? detail.credential.password : '••••••••••••'}</code></div>
                    <div className="sv-password-actions">
                      <button type="button" ref={revealButton} className="sv-button sv-primary" onClick={() => setShow(visible => !visible)}>
                        <i className={show ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'} aria-hidden="true" />
                        {show ? 'Hide Password' : 'Reveal Password'}
                      </button>
                      <button type="button" className="sv-button" onClick={() => copyPassword(detail.credential.password)}>
                        <i className="fa-solid fa-copy" aria-hidden="true" /> Copy Password
                      </button>
                      <button type="button" className="sv-button" onClick={event => {
                        const card = event.currentTarget.closest('article');
                        closeCredential();
                        setNotice('');
                        setError('');
                        requestAnimationFrame(() => card?.querySelector('.sv-share-actions button')?.focus());
                      }}>Close</button>
                    </div>
                  </div>
                </section>
              )}
            </article>
          );
        })}
      </div>
    )}
  </section>
  <section className="sv-card" role="tabpanel" id="share-panel-history" aria-labelledby="share-tab-history" hidden={tab!=='history'}>
    <header className="sv-heading">
      <span className="sv-icon" aria-hidden="true"><i className="fa-solid fa-clock-rotate-left" /></span>
      <div><h2>Sharing History</h2><p>Recorded activity for your incoming and outgoing shares.</p></div>
      {records.history.loaded && <span className="sv-count">{history.length}</span>}
    </header>
    <ShareState state={records.history} empty={!history.length} label="sharing history" emptyText="No sharing activity yet." retry={load} />
    {records.history.loaded && history.length > 0 && (
      <ol className="sv-history">
        {history.map(event => {
          const [label, icon] = historyActions[event.action] ?? [event.action.replaceAll('_', ' '), 'fa-clock-rotate-left'];
          const result = event.result === 'FAILURE' ? 'Failed' : event.result === 'SUCCESS' ? 'Success' : event.result;
          return (
            <li className="sv-row sv-history-event" key={event.id}>
              <span className="sv-icon" aria-hidden="true"><i className={'fa-solid ' + icon} /></span>
              <div>
                <h3>{label}</h3>
                <ShareDate value={event.timestamp} />
                {(event.credentialRef || event.recipientRef) && <dl className="sv-share-details">
                  {event.credentialRef && <div><dt>Credential reference</dt><dd className="sv-reference">{event.credentialRef}</dd></div>}
                  {event.recipientRef && <div><dt>Recipient reference</dt><dd className="sv-reference">{event.recipientRef}</dd></div>}
                </dl>}
              </div>
              {result && <span className={'sv-status ' + (result === 'Failed' ? 'revoked' : result === 'Success' ? 'active' : '')}>{result}</span>}
            </li>
          );
        })}
      </ol>
    )}
  </section>
 </div>;
}
