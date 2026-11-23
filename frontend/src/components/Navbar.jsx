import React from 'react';

export default function Navbar({ activeView, setActiveView }) {
  return (
    <header className="navbar public-navbar">
      <div className="nav-container">
        <span className="nav-brand">
          <span className="brand-logo-icon"><i className="fa-solid fa-shield-halved" aria-hidden="true" /></span>
          <span className="brand-name">SecureVault</span>
        </span>
        <nav className="nav-links" aria-label="Sign-in options">
          <button type="button" className={`nav-link-btn ${activeView === 'login' ? 'active' : ''}`}
            aria-current={activeView === 'login' ? 'page' : undefined} onClick={() => setActiveView('login')}>User Login</button>
          <button type="button" className="nav-link-btn admin-link" onClick={() => setActiveView('admin')}>Admin Login</button>
        </nav>
      </div>
    </header>
  );
}
