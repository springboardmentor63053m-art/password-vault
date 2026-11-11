import React, {useEffect, useState} from 'react';
import {vaultRequest} from '../services/vaultApi';
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
  return <section className="user-vault-panel"><h2>Account Security</h2>{error&&<p role="alert">{error}</p>}
    <button onClick={load} disabled={busy}>Refresh security information</button>
    <form onSubmit={change}><h3>Change password</h3><p>This signs out all sessions. Your vault encryption key stays unchanged.</p>
      <label>Current password<input type="password" autoComplete="current-password" required value={password.currentPassword} onChange={e=>setPassword({...password,currentPassword:e.target.value})}/></label>
      <label>New password<input type="password" autoComplete="new-password" minLength={12} maxLength={72} required value={password.newPassword} onChange={e=>setPassword({...password,newPassword:e.target.value})}/></label>
      {data?.mfaEnabled&&<label>Authenticator code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required value={password.code} onChange={e=>setPassword({...password,code:e.target.value})}/></label>}
      <button disabled={busy||!data}>Change password and sign out</button>
    </form>
    <MfaSettingsPanel getStatus={getMfaStatus} startSetup={startTotpSetup} confirmSetup={confirmTotpSetup} disable={disableTotp}/>
    <h3>Sessions</h3>{data?.sessions.length===0&&<p>No recorded sessions are available.</p>}{data?.sessions.map(s=><article key={s.id}><p>{s.current?'Current session · ':''}{s.ip||'IP unavailable'} · {s.revoked?'Revoked':new Date(s.expiresAt)>new Date()?'Active':'Expired'}</p><p>Started {new Date(s.createdAt).toLocaleString()}</p>{!s.revoked&&<button disabled={busy} onClick={()=>revoke('sessions',s)}>Revoke session</button>}</article>)}
    <h3>Devices</h3><p>Labels are observations from request headers, not verified hardware identities.</p>{data?.devices.map(d=><article key={d.id}><p>{d.category} · {d.os} · {d.browser}{d.current?' · Current':''}</p><p>{d.activeSessions} active sessions · {d.trusted?'Trusted':'Not trusted'}</p>{d.activeSessions>0&&<button disabled={busy} onClick={()=>revoke('devices',d)}>Revoke device sessions</button>}</article>)}
    <h3>Recent security activity</h3>{data?.activities.length===0&&<p>No security activity recorded in this history window.</p>}{data?.activities.map(a=><p key={a.id}>{a.action} · {a.result} · {new Date(a.timestamp).toLocaleString()}</p>)}
    {data?.recommendations.map(t=><p key={t}>{t}</p>)}
  </section>;
}
