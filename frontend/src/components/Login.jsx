import React, { useState } from 'react';
import { loginUser } from '../services/api';

export default function Login({ onLoginSuccess, onNavigateRegister }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setStatusMessage({ type: 'error', text: 'Please enter your username/email and password.' });
      return;
    }

    setLoading(true);
    setStatusMessage(null);

    const result = await loginUser({ identifier, password });
    setLoading(false);

    if (result.success) {
      const user = result.data.user || { username: identifier.split('@')[0], email: identifier };
      setStatusMessage({
        type: 'success',
        text: result.isDemo
          ? 'Demo Mode: Authentication successful! Welcome to SecureVault.'
          : 'Login successful! Redirecting to vault...',
      });
      setTimeout(() => {
        onLoginSuccess(user);
      }, 700);
    } else {
      setStatusMessage({
        type: 'error',
        text: result.error || 'Authentication failed. Please verify credentials.',
      });
    }
  };

  const handleOAuthDemo = (provider) => {
    setStatusMessage({
      type: 'info',
      text: `${provider} OAuth integration configured for Milestone 4 & 5.`,
    });
  };

  return (
    <div className="auth-card-wrapper">
      <div className="auth-card">
        {/* Left Branding Panel */}
        <aside className="auth-brand-panel">
          <div className="brand-header">
            <div className="brand-logo-badge">
              <i className="fa-solid fa-user-shield"></i>
            </div>
            <h2 className="brand-title">SecureVault</h2>
            <p className="brand-subtitle">
              Enterprise-Grade Credential & Password Management
            </p>
          </div>

          <div className="brand-graphic">
            <div className="shield-rings">
              <div className="ring ring-1"></div>
              <div className="ring ring-2"></div>
              <div className="shield-icon-center">
                <i className="fa-solid fa-fingerprint"></i>
              </div>
            </div>
          </div>

          <div className="feature-highlights">
            <div className="feature-item">
              <i className="fa-solid fa-lock"></i>
              <span>AES-256-GCM Zero-Knowledge</span>
            </div>
            <div className="feature-item">
              <i className="fa-solid fa-key"></i>
              <span>PBKDF2 Salted Key Derivation</span>
            </div>
            <div className="feature-item">
              <i className="fa-solid fa-shield-virus"></i>
              <span>Brute-force Lockout & Session Tracking</span>
            </div>
          </div>

          <div className="brand-footer-text">
            <span>Team 3 &bull; Infosys Springboard Project</span>
          </div>
        </aside>

        {/* Right Form Panel */}
        <main className="auth-form-panel">
          <div className="form-content-area">
            <header className="form-header">
              <h1 className="form-heading">Welcome Back</h1>
              <p className="form-subheading">Sign in to unlock your secure password vault</p>
            </header>

            {statusMessage && (
              <div className={`status-banner ${statusMessage.type}`}>
                <i
                  className={`fa-solid ${
                    statusMessage.type === 'error'
                      ? 'fa-circle-exclamation'
                      : statusMessage.type === 'success'
                      ? 'fa-circle-check'
                      : 'fa-circle-info'
                  }`}
                ></i>
                <span>{statusMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="input-field-group">
                <label htmlFor="identifier">Username or Email</label>
                <div className="input-wrapper">
                  <i className="fa-regular fa-envelope input-icon"></i>
                  <input
                    id="identifier"
                    type="text"
                    placeholder="e.g. vaultuser or user@example.com"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              <div className="input-field-group">
                <div className="label-row">
                  <label htmlFor="password">Master Password</label>
                  <button
                    type="button"
                    className="forgot-link"
                    onClick={() =>
                      setStatusMessage({
                        type: 'info',
                        text: 'Password reset token flow is initiated via PostgreSQL reset_password_token.',
                      })
                    }
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="input-wrapper">
                  <i className="fa-solid fa-key input-icon"></i>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your master password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <i className={`fa-regular ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
              </div>

              <div className="form-options-row">
                <label className="checkbox-control">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span>Remember my device</span>
                </label>
              </div>

              <button type="submit" className="primary-action-btn" disabled={loading}>
                {loading ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i> Authenticating...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-lock-open"></i> Unlock Vault
                  </>
                )}
              </button>
            </form>

            <div className="form-divider">
              <span>or sign in with</span>
            </div>

            <div className="social-actions-grid">
              <button
                type="button"
                className="social-btn"
                onClick={() => handleOAuthDemo('Google')}
              >
                <img src="/images/google.png" alt="Google" onError={(e) => (e.target.style.display = 'none')} />
                <i className="fa-brands fa-google social-icon-fallback"></i>
                <span>Google</span>
              </button>
              <button
                type="button"
                className="social-btn"
                onClick={() => handleOAuthDemo('Microsoft')}
              >
                <img src="/images/microsoft.png" alt="Microsoft" onError={(e) => (e.target.style.display = 'none')} />
                <i className="fa-brands fa-microsoft social-icon-fallback"></i>
                <span>Microsoft</span>
              </button>
            </div>

            <footer className="form-footer">
              <p>
                Don't have an account?{' '}
                <button type="button" className="switch-auth-link" onClick={onNavigateRegister}>
                  Create an account
                </button>
              </p>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
