import React, { useId, useRef, useState } from 'react';
import '../admin/admin.css';

export default function WorkspaceLayout({
  role, username, navigationLabel, items, activePage, onNavigate, onSignOut,
  privacyText, privacyPage, toolbar, children,
}) {
  const sidebarId = useId();
  const menuButton = useRef(null);
  const closeButton = useRef(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const activeLabel = items.find((item) => item.id === activePage)?.label;

  function closeNavigation() {
    if (!sidebarOpen) return;
    setSidebarOpen(false);
    menuButton.current?.focus();
  }

  function navigate(page) {
    closeNavigation();
    onNavigate(page);
  }

  return (
    <div className="admin-shell">
      {sidebarOpen && (
        <button type="button" className="sidebar-scrim" tabIndex={-1} onClick={closeNavigation} aria-label="Dismiss navigation" />
      )}
      <aside
        id={sidebarId}
        className={'admin-sidebar' + (sidebarOpen ? ' sidebar-open' : '')}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && sidebarOpen) closeNavigation();
        }}
      >
        <div className="sidebar-brand">
          <button type="button" className="sidebar-home" onClick={() => navigate(items[0].id)}>
            <span className="admin-brand-mark"><i className="fa-solid fa-shield-halved" aria-hidden="true" /></span>
            <span><strong>SecureVault</strong><small>{role === 'ADMIN' ? 'ADMIN CONSOLE' : 'USER WORKSPACE'}</small></span>
          </button>
          <button type="button" ref={closeButton} className="mobile-menu-button sidebar-close" aria-label="Close navigation" onClick={closeNavigation}>
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>
        <div className="sidebar-section-label">WORKSPACE</div>
        <nav className="sidebar-nav" aria-label={navigationLabel}>
          {items.map(({ id, label, icon, count }) => (
            <button type="button" key={id} className={'sidebar-nav-item' + (activePage === id ? ' selected' : '')}
              aria-current={activePage === id ? 'page' : undefined} onClick={() => navigate(id)}>
              <i className={icon} aria-hidden="true" />
              <span>{label}</span>
              {count > 0 && <b className="sidebar-alert-count">{count}</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-privacy-card">
          <div className="privacy-card-icon"><i className="fa-solid fa-lock" aria-hidden="true" /></div>
          <strong>Private by design</strong>
          <p>{privacyText}</p>
          <button type="button" onClick={() => navigate(privacyPage)}>
            Learn about privacy <i className="fa-solid fa-arrow-right" aria-hidden="true" />
          </button>
        </div>
        <div className="sidebar-user">
          <button type="button" className="admin-signout" onClick={onSignOut}>
            <i className="fa-solid fa-arrow-right-from-bracket" aria-hidden="true" /> Sign out
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <header className="admin-topbar">
          <div className="topbar-leading">
            <button type="button" ref={menuButton} className="mobile-menu-button" aria-label="Open navigation"
              aria-expanded={sidebarOpen} aria-controls={sidebarId} onClick={() => {
                setSidebarOpen(true);
                requestAnimationFrame(() => closeButton.current?.focus());
              }}>
              <i className="fa-solid fa-bars" aria-hidden="true" />
            </button>
            <div className="topbar-breadcrumb">
              <span>SecureVault</span><i className="fa-solid fa-chevron-right" aria-hidden="true" /><strong>{activeLabel}</strong>
            </div>
          </div>
          <div className="topbar-actions">
            {toolbar}
            <span className="admin-header-account">
              <strong title={username}>{username}</strong><span className="admin-pill-tag">{role}</span>
            </span>
          </div>
        </header>
        <div className="admin-content">{children}</div>
      </main>
    </div>
  );
}
