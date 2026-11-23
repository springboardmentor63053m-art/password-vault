import React, { useEffect, useState } from 'react';
import { vaultApi } from '../services/vaultApi';
export default function VaultOverview({ onOpenVault }) {
  const [overview,setOverview]=useState(null),[error,setError]=useState('');
  async function load(){try{setOverview(await vaultApi.overview());setError('');}catch(e){setError(e.message);}}
  useEffect(()=>{load();},[]);
  if(error)return <section className="vault-main-card"><p role="alert">{error}</p><button onClick={load}>Retry overview</button></section>;
  if(!overview)return <p role="status">Loading your vault overview…</p>;
  const h=overview.health;
  const metrics=[['Stored credentials',h.total],['Strong passwords',h.strong],['Moderate passwords',h.moderate],['Weak passwords',h.weak],['Reused passwords',h.reused],['Password health',h.score==null?'Not assessed':`${h.score}/100`],['Credentials shared by you',overview.sharedByMe],['Credentials shared with you',overview.sharedWithMe]];
  const icons=['vault','shield-halved','chart-simple','triangle-exclamation','key','heart-pulse','share-nodes','inbox'];
  const tones=['blue','green','amber','red','violet','cyan','blue','cyan'];
  return <><section className="user-overview-hero"><div><span className="workspace-eyebrow">YOUR SECURITY AT A GLANCE</span><h2>Everything private, <em>in view.</em></h2><p>Keep your credentials organized. Build stronger passwords and stay in control of shared access.</p><button onClick={onOpenVault}>Open My Vault <span aria-hidden="true">→</span></button><small><i className="fa-solid fa-lock" aria-hidden="true"/> Personal vault insights</small></div><div className={`user-health-ring ${h.score==null?'unassessed':''}`} style={{'--health-progress':`${h.score??0}%`}} aria-label={h.score==null?'Password health not assessed':`Password health ${h.score} out of 100`}><div><strong>{h.score==null?'—':`${h.score}%`}</strong><span>PASSWORD HEALTH</span></div></div></section>
    <section className="stats-grid">{metrics.map(([label,value],index)=><article className={`stat-card tone-${tones[index]}`} key={label}><div className="user-stat-top"><span className="user-stat-icon"><i className={`fa-solid fa-${icons[index]}`} aria-hidden="true"/></span><span className="user-stat-category">{index<6?'Password health':'Shared access'}</span></div><div className="stat-info"><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong></div></article>)}</section>
    <section className="vault-main-card"><h2>Security suggestions</h2><ul>{overview.suggestions.map(text=><li key={text}>{text}</li>)}</ul>
      {h.warnings.map((warning,i)=><p key={`${warning.credentialId}-${i}`}>{warning.message} <button onClick={onOpenVault}>Review credential in My Vault</button></p>)}
      <p>Reused-password totals count every credential involved in reuse. Sharing totals count distinct credentials with active, unexpired access.</p></section>
    <section className="vault-main-card"><h2>Recent vault activity</h2>{overview.recentActivities.length?<ul>{overview.recentActivities.map(a=><li key={a.id}>{a.action.replaceAll('_',' ')} · {a.result} · <time dateTime={a.timestamp}>{new Date(a.timestamp).toLocaleString()}</time></li>)}</ul>:<p>No vault activity recorded yet.</p>}</section></>;
}
