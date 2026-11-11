import React, {useEffect,useState} from 'react';
import {vaultRequest} from '../services/vaultApi';
export const notificationApi={
 list:(page=0,unread=false)=>vaultRequest(`/notifications?${new URLSearchParams({page,size:20,unread})}`),
 unread:()=>vaultRequest('/notifications/unread'),
 mark:id=>vaultRequest(`/notifications/${id}/read`,{method:'PUT'}),
 markAll:()=>vaultRequest('/notifications/read',{method:'PUT'}),
};
export default function NotificationsPanel({onUnreadChange=()=>{}}){
 const [data,setData]=useState(null),[page,setPage]=useState(0),[onlyUnread,setOnlyUnread]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function load(){const result=await notificationApi.list(page,onlyUnread);setData(result);onUnreadChange(result.unread);}
 useEffect(()=>{load().catch(e=>setError(e.message));},[page,onlyUnread]);
 async function mark(work){setBusy(true);try{await work();await load();setError('');}catch(e){setError(e.message);}finally{setBusy(false);}}
 return <section className="vault-main-card user-vault-panel notifications-panel">
  <div className="notifications-heading"><div><span className="workspace-eyebrow">ACTIVITY INBOX</span><h2>Notifications</h2><p>Updates about your vault, shared access, and account security.</p></div><span className="notifications-unread-count">{data?`${data.unread} unread`:'Loading'}</span></div>
  {error&&<p role="alert">{error}</p>}
  <div className="notifications-toolbar"><label><input type="checkbox" checked={onlyUnread} onChange={e=>{setOnlyUnread(e.target.checked);setPage(0);}}/>Unread only</label><div className="notifications-toolbar-actions"><button disabled={busy||!data?.unread} onClick={()=>mark(notificationApi.markAll)}><i className="fa-solid fa-check-double" aria-hidden="true"/> Mark all as read</button><button onClick={()=>load().catch(e=>setError(e.message))}><i className="fa-solid fa-rotate-right" aria-hidden="true"/> Refresh notifications</button></div></div>
  {data?<><p className="notifications-summary">{data.total} matching notifications</p><div className="notification-list">{data.items.length?data.items.map(n=>{
   const security=n.type==='SECURITY_WARNING'||n.type==='VAULT_ACCESS_DENIED';
   const sharing=/SHAR/.test(n.type||'');
   const icon=security?'shield-halved':sharing?'share-nodes':'bell';
   return <article className={`notification-item ${n.read?'is-read':'is-unread'} ${security?'notice-security':''}`} key={n.id}>
    <span className="notification-icon"><i className={`fa-solid fa-${icon}`} aria-hidden="true"/></span>
    <div className="notification-content"><h3>{!n.read&&<span className="notification-dot" aria-hidden="true"/>}{n.title}</h3><p>{n.message}</p><div className="notification-meta"><time dateTime={n.createdAt}>{new Date(n.createdAt).toLocaleString()}</time><span className="notification-state">{n.read?'Read':'Unread'}</span></div></div>
    {!n.read&&<button className="notification-read-action" disabled={busy} onClick={()=>mark(()=>notificationApi.mark(n.id))}>Mark as read</button>}
   </article>;
  }):<div className="notifications-empty"><i className="fa-regular fa-bell" aria-hidden="true"/><p>No matching notifications.</p></div>}</div>
   <nav className="notifications-pagination" aria-label="Notification pagination"><button disabled={page===0||busy} onClick={()=>setPage(page-1)}>Previous notifications</button><span>Page {page+1} of {Math.max(1,Math.ceil(data.total/data.size))}</span><button disabled={(page+1)*data.size>=data.total||busy} onClick={()=>setPage(page+1)}>Next notifications</button></nav></>:!error?<p role="status">Loading notifications…</p>:null}
 </section>;
}
