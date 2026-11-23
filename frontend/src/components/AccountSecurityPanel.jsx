import React, {useEffect, useState} from 'react';
import {vaultRequest} from '../services/vaultApi';
import './SecurityWorkspace.css';
import MfaSettingsPanel from './MfaSettingsPanel';
import {getMfaStatus,startTotpSetup,confirmTotpSetup,disableTotp} from '../services/api';

export default function AccountSecurityPanel({onLogout}) {
  const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [password,setPassword]=useState({currentPassword:'',newPassword:'',code:''});
  const load=()=>vaultRequest('/security').then(setData).catch(e=>setError(e.message));
  useEffect(()=>{load();},[]);
  async function revoke(kind,item){
    if(!window.confirm('Revoke these sessions? This does not permanently block a device.'))return;
    setBusy(true);setError('');
    try{await vaultRequest(`/security/${kind}/${item.id}`,{method:'DELETE'});if(item.current)onLogout?.();else await load();}catch(e){setError(e.message);}finally{setBusy(false);}
  }
  async function change(event){event.preventDefault();setBusy(true);setError('');
    try{await vaultRequest('/security/password',{method:'POST',body:JSON.stringify(password)});setPassword({currentPassword:'',newPassword:'',code:''});onLogout?.();}catch(e){setError(e.message);}finally{setBusy(false);}
  }

  return <section className="sv-settings sv-security" aria-label="Account security settings">
    <div className="sv-security-toolbar">
      {!data&&!error&&<p role="status">Loading security information…</p>}
      <button type="button" className="sv-button" onClick={load} disabled={busy}><i className="fa-solid fa-arrows-rotate" aria-hidden="true"/>Refresh security information</button>
    </div>
    {error&&<p className="sv-feedback sv-error" role="alert">{error}</p>}

    <form className="sv-card" onSubmit={change}>
      <header className="sv-heading"><span className="sv-icon" aria-hidden="true"><i className="fa-solid fa-key"/></span><div><h2>Change password</h2><p>This signs out all sessions. Your vault encryption key stays unchanged.</p></div></header>
      <div className="sv-password-grid">
        <label className="sv-field">Current password<input type="password" autoComplete="current-password" required value={password.currentPassword} onChange={e=>setPassword({...password,currentPassword:e.target.value})}/></label>
        <div className="sv-field"><label className="sv-field">New password<input type="password" autoComplete="new-password" minLength={12} maxLength={72} required value={password.newPassword} onChange={e=>setPassword({...password,newPassword:e.target.value})} aria-describedby="sv-password-hint"/></label><small id="sv-password-hint">Use at least 12 characters.</small></div>
        {data?.mfaEnabled&&<label className="sv-field">Authenticator code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={password.code} onChange={e=>setPassword({...password,code:e.target.value})} placeholder="6-digit code"/></label>}
      </div>
      <div className="sv-footer"><button className="sv-button sv-primary" disabled={busy||!data}>Change password and sign out</button></div>
    </form>

    <MfaSettingsPanel getStatus={getMfaStatus} startSetup={startTotpSetup} confirmSetup={confirmTotpSetup} disable={disableTotp}/>

    <section className="sv-card" aria-labelledby="sv-sessions">
      <header className="sv-heading"><span className="sv-icon" aria-hidden="true"><i className="fa-solid fa-clock-rotate-left"/></span><div><h2 id="sv-sessions">Sessions</h2><p>Review sign-ins and revoke access you no longer need.</p></div></header>
      {data?.sessions.length===0&&<p className="sv-empty">No recorded sessions are available.</p>}
      <div className="sv-list">{data?.sessions.map(s=>{
        const status=s.revoked?'Revoked':new Date(s.expiresAt)>new Date()?'Active':'Expired';
        return <article className="sv-row sv-security-row" key={s.id}>
          <div><div className="sv-inline"><h3>{s.current?'Current session':s.ip||'IP unavailable'}</h3><span className={`sv-status ${status.toLowerCase()}`}>{status}</span></div>
          <p>{s.current&&`${s.ip||'IP unavailable'} · `}Started {new Date(s.createdAt).toLocaleString()}</p></div>
          {!s.revoked&&<button className="sv-button sv-danger" disabled={busy} onClick={()=>revoke('sessions',s)}>Revoke session</button>}
        </article>;
      })}</div>
    </section>

    <section className="sv-card" aria-labelledby="sv-devices">
      <header className="sv-heading"><span className="sv-icon" aria-hidden="true"><i className="fa-solid fa-laptop"/></span><div><h2 id="sv-devices">Devices</h2><p>Device labels come from browser request headers.</p></div></header>
      {data?.devices.length===0&&<p className="sv-empty">No devices are recorded yet.</p>}
      <div className="sv-list">{data?.devices.map(d=><article className="sv-row sv-security-row" key={d.id}>
        <div><div className="sv-inline"><h3>{d.category} · {d.os} · {d.browser}</h3>{d.current&&<span className="sv-status active">Current device</span>}</div>
        <p>{d.activeSessions} {d.activeSessions===1?'active session':'active sessions'} · {d.trusted?'Trusted':'Not trusted'}</p></div>
        {d.activeSessions>0&&<button className="sv-button sv-danger" disabled={busy} onClick={()=>revoke('devices',d)}>Revoke device sessions</button>}
      </article>)}</div>
    </section>

    <section className="sv-card" aria-labelledby="sv-activity">
      <header className="sv-heading"><div><h2 id="sv-activity">Recent security activity</h2></div></header>
      {data?.activities.length===0&&<p className="sv-empty">No security activity recorded in this history window.</p>}
      <div className="sv-list">{data?.activities.map(a=><article className="sv-row sv-security-row" key={a.id}><h3>{a.action.replaceAll('_',' ')}</h3><p>{a.result} · {new Date(a.timestamp).toLocaleString()}</p></article>)}</div>
      {data?.recommendations.map(t=><p className="sv-feedback" key={t}>{t}</p>)}
    </section>
  </section>;
}
