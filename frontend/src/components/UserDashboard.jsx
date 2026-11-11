import React, { useEffect, useState } from 'react';
import VaultPanel from './VaultPanel';
import VaultOverview from './VaultOverview';
import SecureShare from './SecureShare';
import NotificationsPanel, {notificationApi} from './NotificationsPanel';
import AccountSecurityPanel from './AccountSecurityPanel';
import HelpSupport from './HelpSupport';
import './VaultAurora.css';

const pages=[['overview','Dashboard','chart-pie'],['vault','My Vault','vault'],['shares','Secure Share','share-nodes'],['notifications','Notifications','bell'],['security','Account Security','shield-halved'],['help','Help & Support','circle-question'],['profile','Profile / Settings','user']];
const descriptions={overview:'A private view of your credentials, password health, and shared access.',vault:'Keep your website and app credentials organized and protected.',shares:'Control who can view your credentials, and for how long.',notifications:'Your account activity and security updates, in one place.',security:'Review your authenticator, sessions, devices, and account protection.',help:'Practical guidance for using SecureVault with confidence.',profile:'Your account details and workspace access.'};
export default function UserDashboard({ currentUser, onLogout }) {
  const [page,setPage]=useState('overview'),[unread,setUnread]=useState(null),[notificationError,setNotificationError]=useState('');
  useEffect(()=>{let active=true;const refresh=()=>notificationApi.unread().then(r=>{if(active){setUnread(r.unread);setNotificationError('');}}).catch(e=>{if(active){setUnread(null);setNotificationError(e.message);}});refresh();const timer=setInterval(refresh,30000);return()=>{active=false;clearInterval(timer);};},[]);
  const title=pages.find(([id])=>id===page)[1];
  const today=new Date();
  return <div className="vault-dashboard reference-workspace"><div className="user-workspace-layout">
    <aside className="user-workspace-sidebar">
      <div className="user-sidebar-brand"><span className="workspace-brand-mark"><i className="fa-solid fa-shield-halved" aria-hidden="true"/></span><span><strong>SecureVault</strong><small>USER WORKSPACE</small></span></div>
      <span className="workspace-eyebrow">WORKSPACE</span>
      <nav aria-label="User workspace">{pages.map(([id,label,icon])=><button key={id} className={`category-pill ${page===id?'active':''}`} aria-current={page===id?'page':undefined} onClick={()=>setPage(id)}><i className={`fa-solid fa-${icon}`} aria-hidden="true"/>{label}{id==='notifications'&&unread>0&&<span className="user-nav-count">{unread}</span>}</button>)}</nav>
      <div className="workspace-privacy"><i className="fa-solid fa-lock" aria-hidden="true"/><strong>Private by design</strong><p>Credential values stay out of notifications and administrator monitoring.</p><button onClick={()=>setPage('help')}>Learn about privacy <span aria-hidden="true">→</span></button></div>
    </aside>
    <div className="user-workspace-content">
      <div className="user-workspace-toolbar"><span className="workspace-eyebrow">USER WORKSPACE</span><button aria-label={`Notifications${unread==null?'':` (${unread} unread)`}`} onClick={()=>setPage('notifications')}><i className="fa-regular fa-bell" aria-hidden="true"/> {unread==null?'Notifications':`${unread} unread`}</button></div>
      <div className="user-page-body">{page!=='vault'&&<header className="dashboard-header"><div><h1>{page==='overview'?`Good to see you, ${currentUser?.username}`:title}</h1><p className="section-sub">{descriptions[page]}</p></div><time className="user-date-badge" dateTime={today.toISOString().slice(0,10)}><i className="fa-regular fa-calendar" aria-hidden="true"/>{new Intl.DateTimeFormat('en-IN',{weekday:'short',day:'numeric',month:'short'}).format(today)}</time></header>}
      {notificationError&&page!=='notifications'&&<p className="workspace-alert" role="status">Notification status unavailable. {notificationError}</p>}
      {page==='overview'&&<VaultOverview onOpenVault={()=>setPage('vault')}/>}
      {page==='vault'&&<VaultPanel/>}
      {page==='shares'&&<SecureShare/>}
      {page==='notifications'&&<NotificationsPanel onUnreadChange={setUnread}/>}
      {page==='security'&&<AccountSecurityPanel onLogout={onLogout}/>}
      {page==='help'&&<HelpSupport/>}
      {page==='profile'&&<section className="user-vault-panel user-profile-card"><span className="workspace-eyebrow">ACCOUNT DETAILS</span><div className="user-profile-identity"><span className="user-profile-avatar" aria-hidden="true">{currentUser?.username?.slice(0,1).toUpperCase()}</span><div><h2>Profile</h2><p>Your verified SecureVault identity.</p></div></div><dl className="user-profile-fields"><div><dt>Username</dt><dd>{currentUser?.username}</dd></div><div><dt>Email</dt><dd>{currentUser?.email||'Not supplied'}</dd></div><div><dt>Workspace access</dt><dd>{currentUser?.roles?.map(role=><span className="user-role-pill" key={role}>{role==='ROLE_ADMIN'?'Administrator':role==='ROLE_USER'?'User':role.replace('ROLE_','')}</span>)}</dd></div></dl><p>Account access is verified by the server. Manage your password and authenticator in Account Security.</p><button onClick={()=>setPage('security')}>Manage account security <span aria-hidden="true">→</span></button></section>}
      </div>
    </div>
  </div></div>;
}
