import React, { useEffect, useState } from 'react';
import { vaultApi, vaultRequest } from '../services/vaultApi';
export const shareApi = {
  sent:()=>vaultRequest('/shares/sent'), received:()=>vaultRequest('/shares/received'), history:()=>vaultRequest('/shares/history'),
  recipients:search=>vaultRequest(`/shares/recipients?${new URLSearchParams({search})}`),
  create:body=>vaultRequest('/shares',{method:'POST',body:JSON.stringify(body)}),
  revoke:id=>vaultRequest(`/shares/${id}`,{method:'DELETE'}),
  expiry:(id,expiresAt)=>vaultRequest(`/shares/${id}/expiry`,{method:'PATCH',body:JSON.stringify({expiresAt})}),
  read:id=>vaultRequest(`/shares/${id}/credential`),
};
const localTime=value=>value?new Date(new Date(value).getTime()-new Date(value).getTimezoneOffset()*60000).toISOString().slice(0,16):'';
export default function SecureShare(){
 const [tab,setTab]=useState('sent');
 const [loaded,setLoaded]=useState(false);
 const [sent,setSent]=useState([]),[received,setReceived]=useState([]),[history,setHistory]=useState([]),[items,setItems]=useState([]);
 const [credential,setCredential]=useState(''),[search,setSearch]=useState(''),[matches,setMatches]=useState([]),[recipient,setRecipient]=useState(''),[expires,setExpires]=useState('');
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[detail,setDetail]=useState(null),[show,setShow]=useState(false),[edits,setEdits]=useState({});
 async function load(){const [a,b,c,d]=await Promise.all([shareApi.sent(),shareApi.received(),shareApi.history(),vaultApi.list()]);setSent(a);setReceived(b);setHistory(c);setItems(d);setLoaded(true);}
 useEffect(()=>{load().catch(e=>setError(e.message));},[]);
 useEffect(()=>{if(!detail)return;const timer=setTimeout(()=>{setDetail(null);setShow(false);},30000);return()=>clearTimeout(timer);},[detail]);
 async function action(work,message){setBusy(true);setError('');setNotice('');try{await work();setDetail(null);setShow(false);await load();setNotice(message);}catch(e){setError(e.message);}finally{setBusy(false);}}
 return <div className="user-vault-panel secure-share-panel"><nav className="sharing-tabs" role="tablist" aria-label="Sharing sections">{[["sent","Shared by Me"],["received","Shared with Me"],["history","Sharing History"]].map(([id,label],index)=><button type="button" role="tab" key={id} id={`share-tab-${id}`} aria-selected={tab===id} aria-controls={`share-panel-${id}`} tabIndex={tab===id?0:-1} onClick={()=>{setTab(id);setDetail(null);setShow(false);}} onKeyDown={e=>{let next;if(e.key==="ArrowRight")next=(index+1)%3;else if(e.key==="ArrowLeft")next=(index+2)%3;else if(e.key==="Home")next=0;else if(e.key==="End")next=2;else return;e.preventDefault();e.currentTarget.parentElement.children[next].click();e.currentTarget.parentElement.children[next].focus();}}>{label}</button>)}</nav>
  <section className="vault-main-card"><h2>Share a credential</h2>{!loaded&&!error&&<p role="status">Loading sharing records…</p>}<p>View Only access lets the selected recipient read and copy this credential, including notes. It does not allow editing or resharing. Revocation stops future access; it cannot erase copies already received.</p>
   {error&&<p role="alert" className="mfa-message error">{error}</p>}{notice&&<p role="status" className="mfa-message success">{notice}</p>}
   <form hidden={tab!=="sent"} className="modal-form compact-share-form" onSubmit={e=>{e.preventDefault();action(()=>shareApi.create({credentialId:credential,recipientId:recipient,expiresAt:expires?new Date(expires).toISOString():null}),'Credential shared with View Only access.');}}>
    <label className="input-field-group">Stored credential<select aria-label="Stored credential to share" required value={credential} onChange={e=>setCredential(e.target.value)}><option value="">Select your credential</option>{items.map(i=><option key={i.id} value={i.id}>{i.title}</option>)}</select></label>
    <label className="input-field-group">Exact recipient username or email<input aria-label="Exact recipient username or email" minLength={3} maxLength={120} value={search} onChange={e=>{setSearch(e.target.value);setRecipient('');setMatches([]);}}/></label>
    <button type="button" disabled={busy||search.trim().length<3} onClick={async()=>{try{setMatches(await shareApi.recipients(search));setError('');setNotice('Recipient search complete. Select a matching account; an empty list means no match.');}catch(e){setError(e.message);}}}>Search recipient</button>
    <label className="input-field-group">Registered recipient<select aria-label="Registered recipient" required value={recipient} onChange={e=>setRecipient(e.target.value)}><option value="">Select recipient</option>{matches.map(r=><option key={r.id} value={r.id}>{r.username}</option>)}</select></label>
    <label className="input-field-group">Access expires (optional)<input aria-label="Share expiry" type="datetime-local" value={expires} onChange={e=>setExpires(e.target.value)}/></label>
    <p>Permission: View Only. Access becomes active immediately; acceptance is not required.</p><button className="primary-action-btn" disabled={busy}>Share credential</button>
   </form></section>
  <section className="vault-main-card" role="tabpanel" id="share-panel-sent" aria-labelledby="share-tab-sent" hidden={tab!=="sent"}><h2>Shared by Me</h2>{loaded&&!error&&!sent.length&&<p>No outgoing shares.</p>}{sent.map(s=><article className="vault-item-row" key={s.id}><div><strong>To {s.recipient}</strong><p>{s.status} · View Only · {s.expiresAt?`Expires ${new Date(s.expiresAt).toLocaleString()}`:'No expiry'}</p><small>Credential reference: {s.credentialId}</small></div>
   {s.status==='ACTIVE'&&<div className="vault-item-actions"><label>New expiry<input aria-label={`New expiry for ${s.recipient}`} type="datetime-local" value={edits[s.id]??localTime(s.expiresAt)} onChange={e=>setEdits({...edits,[s.id]:e.target.value})}/></label><button disabled={busy} onClick={()=>action(()=>shareApi.expiry(s.id,(edits[s.id]??localTime(s.expiresAt))?new Date(edits[s.id]??localTime(s.expiresAt)).toISOString():null),'Share expiry updated.')}>Update expiry</button><button disabled={busy} onClick={()=>{if(window.confirm('Revoke this recipient’s future access?'))action(()=>shareApi.revoke(s.id),'Shared access revoked.');}}>Revoke access</button></div>}</article>)}</section>
  <section className="vault-main-card" role="tabpanel" id="share-panel-received" aria-labelledby="share-tab-received" hidden={tab!=="received"}><h2>Shared with Me</h2>{loaded&&!error&&!received.length&&<p>No received shares.</p>}{received.map(s=><article className="vault-item-row" key={s.id}><div><strong>From {s.owner}</strong><p>{s.status} · View Only</p></div>{s.status==='ACTIVE'&&<button disabled={busy} onClick={async()=>{try{setDetail(await shareApi.read(s.id));setShow(false);}catch(e){setError(e.message);}}}>View shared credential</button>}</article>)}
   {detail&&<section className="mfa-panel"><h3>{detail.title}</h3><p>{detail.username}</p><p>{detail.url}</p><p>{show?detail.password:'••••••••••••'}</p><button onClick={()=>setShow(!show)}>{show?'Hide':'Show'} shared password</button><button onClick={async()=>{try{await navigator.clipboard.writeText(detail.password);setNotice('Shared password copied.');}catch{setError('Clipboard access unavailable.');}}}>Copy shared password</button><p>{detail.notes}</p><button onClick={()=>{setDetail(null);setShow(false);}}>Close shared credential</button></section>}
  </section>
  <section className="vault-main-card" role="tabpanel" id="share-panel-history" aria-labelledby="share-tab-history" hidden={tab!=="history"}><h2>Sharing History</h2>{history.length?<ul>{history.map(h=><li className="share-history-card" key={h.id}>{h.action.replaceAll('_',' ')} · {h.result==='FAILURE'?'FAILED':h.result} · {new Date(h.timestamp).toLocaleString()}</li>)}</ul>:loaded&&!error?<p>No sharing activity yet.</p>:null}</section>
 </div>;
}
