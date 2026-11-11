import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import PasswordGenerator,{PasswordAssessment} from './PasswordGenerator';

export default function CredentialModal({form,editing,categories,onChange,onSubmit,onClose,onPasswordBlur,busy,error,reused,theme}){
 const dialog=useRef(null),[show,setShow]=useState(false),[copied,setCopied]=useState(false),[copyError,setCopyError]=useState('');
 useEffect(()=>{
  const previous=document.activeElement,overflow=document.body.style.overflow,root=document.getElementById('root'),wasInert=root?.hasAttribute('inert');
  document.body.style.overflow='hidden';root?.setAttribute('inert','');dialog.current?.querySelector('input')?.focus();
  return()=>{document.body.style.overflow=overflow;if(root&&!wasInert)root.removeAttribute('inert');if(previous?.isConnected)previous.focus();};
 },[]);
 useEffect(()=>{setCopied(false);setCopyError('');},[form.password]);
 useEffect(()=>{if(!copied)return;const timer=setTimeout(()=>setCopied(false),1800);return()=>clearTimeout(timer);},[copied]);
 function keys(event){
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onClose();}
  if(event.key!=='Tab')return;
  const focusable=[...dialog.current.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex="0"]')].filter(el=>!el.closest('[hidden]')&&(!el.closest('details:not([open])')||el.tagName==='SUMMARY'));
  const first=focusable[0],last=focusable.at(-1);
  if(event.shiftKey&&(document.activeElement===first||document.activeElement===dialog.current)){event.preventDefault();last?.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
 }
 async function copy(){try{await navigator.clipboard.writeText(form.password);setCopied(true);setCopyError('');}catch{setCopyError('Clipboard access is unavailable.');}}
 return createPortal(<div className="aurora-vault vault-modal-overlay" data-vault-theme={theme} onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}} onKeyDown={keys}>
  <section ref={dialog} role="dialog" aria-modal="true" aria-labelledby="credential-form-title" aria-describedby="credential-form-description" tabIndex={-1} className="vault-credential-dialog">
   <header className="credential-dialog-header"><div><span className="aurora-eyebrow">YOUR PRIVATE VAULT</span><h2 id="credential-form-title">{editing?'Edit Credential':'Add Credential'}</h2><p id="credential-form-description">Keep the details you need, protected in one place.</p></div><button type="button" className="aurora-icon-button" aria-label="Close credential dialog" title="Close" disabled={busy} onClick={onClose}><i className="fa-solid fa-xmark" aria-hidden="true"/></button></header>
   <form onSubmit={onSubmit} className="credential-dialog-form">
    <div className="credential-dialog-body">
     {error&&<p role="alert" className="aurora-message error">{error}</p>}
     <div className="credential-field-grid">
      {[['title','Website / app name','text',255],['url','Website URL','url',2048],['username','Username / email','text',320]].map(([key,label,type,max])=><label key={key}>{label}<input aria-label={label} type={type} maxLength={max} required={key==='title'} autoComplete="off" value={form[key]} onChange={e=>onChange(key,e.target.value)}/></label>)}
      <label>Credential category<select aria-label="Credential category" required value={form.categoryId} onChange={e=>onChange('categoryId',e.target.value)}><option value="" disabled>Select a category</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
     </div>
     <div className="credential-password-section"><label htmlFor="credential-password">Password</label><div className="credential-password-control"><input id="credential-password" aria-label="Password" type={show?'text':'password'} required maxLength={1024} autoComplete="off" spellCheck={false} value={form.password} onChange={e=>onChange('password',e.target.value)} onBlur={onPasswordBlur}/><button type="button" className="aurora-icon-button" aria-label={show?'Hide password':'Show password'} title={show?'Hide password':'Show password'} onClick={()=>setShow(!show)}><i className={`fa-regular ${show?'fa-eye-slash':'fa-eye'}`} aria-hidden="true"/></button><button type="button" className="aurora-icon-button" aria-label="Copy password" title="Copy password" disabled={!form.password} onClick={copy}><i className={`fa-regular ${copied?'fa-circle-check':'fa-copy'}`} aria-hidden="true"/></button></div><span className="credential-copy-status" role="status">{copied?'Copied':copyError}</span></div>
     <PasswordAssessment password={form.password}/>
     <PasswordGenerator onGenerate={password=>onChange('password',password)}/>
     {reused&&<p role="status" className="aurora-message warning">This password is already used by another credential in your vault. Generate a unique replacement.</p>}
     <label>Notes<textarea aria-label="Notes" maxLength={4000} rows={3} value={form.notes} onChange={e=>onChange('notes',e.target.value)}/></label>
     <label className="aurora-check"><input type="checkbox" checked={form.favorite} onChange={e=>onChange('favorite',e.target.checked)}/>Mark as favorite</label>
    </div>
    <footer className="credential-dialog-footer"><span><i className="fa-solid fa-lock" aria-hidden="true"/> Encrypted when saved</span><div><button type="button" className="aurora-secondary" disabled={busy} onClick={onClose}>Cancel</button><button className="aurora-primary" disabled={busy}>{busy?'Saving…':'Save Credential'}</button></div></footer>
   </form>
  </section>
 </div>,document.body);
}
