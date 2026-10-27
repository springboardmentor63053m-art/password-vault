import React from 'react';

export default function Navbar({ activeView, setActiveView, currentUser, onLogout }) {
  return (
    <header className="navbar">
      <div className="nav-container">
        <div className="nav-brand" onClick={() => setActiveView(currentUser ? 'vault' : 'login')}>
          <div className="brand-logo-icon">
            <i className="fa-solid fa-shield-halved"></i>
          </div>
          <div className="brand-text">
            <span className="brand-name">SecureVault</span>
            <span className="brand-sub">Team 3 &bull; Springboard</span>
          </div>
        </div>

        <nav className="nav-links">
          {!currentUser ? (
            <>
              <button
                className={`nav-link-btn ${activeView === 'login' ? 'active' : ''}`}
                onClick={() => setActiveView('login')}
              >
                <i className="fa-solid fa-right-to-bracket"></i> Login
              </button>
              <button
                className={`nav-link-btn ${activeView === 'register' ? 'active' : ''}`}
                onClick={() => setActiveView('register')}
              >
                <i className="fa-solid fa-user-plus"></i> Register
              </button>
              <button
                className={`nav-link-btn preview-badge ${activeView === 'vault' ? 'active' : ''}`}
                onClick={() => setActiveView('vault')}
              >
                <i className="fa-solid fa-vault"></i> Vault Demo
              </button>
            </>
          ) : (
            <>
              <button
                className={`nav-link-btn ${activeView === 'vault' ? 'active' : ''}`}
                onClick={() => setActiveView('vault')}
              >
                <i className="fa-solid fa-vault"></i> My Vault
              </button>
              <div className="user-profile-pill">
                <i className="fa-solid fa-circle-user"></i>
                <span className="user-name">{currentUser.username || currentUser.email}</span>
              </div>
              <button className="logout-btn" onClick={onLogout} aria-label="Sign out" title="Sign out">
                <i className="fa-solid fa-arrow-right-from-bracket" aria-hidden="true"></i>
                <span>Sign out</span>
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
