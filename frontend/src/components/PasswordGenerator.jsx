import React,{useEffect,useId,useState} from 'react';
import {generatePassword,assessPassword,checkPasswordBreach} from '../services/passwords';
export default function PasswordGenerator({onGenerate}){
 const id=useId();
 const [length,setLength]=useState(20),[options,setOptions]=useState({lowercase:true,uppercase:true,numbers:true,symbols:true}),[error,setError]=useState(''),[generated,setGenerated]=useState(false);
 return <fieldset className="password-generator"><legend>Generate a unique password</legend>
  <div className="generator-quick-row"><p>{length} characters · Browser cryptographic randomness</p><button type="button" onClick={()=>{try{onGenerate(generatePassword(length,options));setGenerated(true);setError('');}catch(e){setError(e.message);}}}><i className="fa-solid fa-arrows-rotate" aria-hidden="true"/> {generated?'Regenerate password':'Generate password'}</button></div>
  <details className="generator-options"><summary>Customize generator</summary><div><label htmlFor={id}>Password length<input id={id} aria-label="Password length" type="number" min={12} max={128} value={length} onChange={e=>setLength(Number(e.target.value))}/></label><div className="generator-character-options">{Object.keys(options).map(key=><label className="aurora-check" key={key}><input type="checkbox" checked={options[key]} onChange={e=>setOptions({...options,[key]:e.target.checked})}/>{key}</label>)}</div></div></details>
  <p className="generator-advice">Prefer at least 16 characters and a unique password for every account.</p>
  {error&&<p role="alert">{error}</p>}
 </fieldset>;
}
export function PasswordAssessment({password}){
 const result=assessPassword(password);
 const [breachStatus,setBreachStatus]=useState(null);
 const [checking,setChecking]=useState(false);

 useEffect(()=>{
  setBreachStatus(null);
  setChecking(false);
 },[password]);

 async function handleBreachCheck(){
  if(!password)return;
  setChecking(true);
  try{
   const res=await checkPasswordBreach(password);
   setBreachStatus(res);
  }catch(err){
   setBreachStatus({breached:false,count:0,message:err.message||'Breach check failed.'});
  }finally{
   setChecking(false);
  }
 }

 return <div className="credential-strength" data-strength={result.strength} aria-live="polite">
  <div className="strength-header-row">
   <strong>Password strength: {result.strength} ({result.score}/100)</strong>
   {Boolean(password)&&<button type="button" className="breach-check-btn" disabled={checking} onClick={handleBreachCheck} title="Check Have I Been Pwned using k-Anonymity (zero knowledge)"><i className={`fa-solid ${checking?'fa-spinner fa-spin':'fa-shield-halved'}`} aria-hidden="true"/> {checking?'Checking…':'Check Data Breaches'}</button>}
  </div>
  <div className="credential-strength-track" role="meter" aria-label="Password strength" aria-valuemin={0} aria-valuemax={100} aria-valuenow={result.score} aria-valuetext={result.strength}><span style={{width:`${result.score}%`}}/></div>
  {breachStatus&&<div className={`breach-result-banner ${breachStatus.breached?'is-breached':'is-safe'}`} role="status"><i className={`fa-solid ${breachStatus.breached?'fa-triangle-exclamation':'fa-circle-check'}`} aria-hidden="true"/> <strong>{breachStatus.breached?'BREACH WARNING:':'SAFE:'}</strong> {breachStatus.message}</div>}
  <details><summary>Password guidance</summary><ul>{result.suggestions.map(text=><li key={text}>{text}</li>)}</ul></details>
 </div>;
}
