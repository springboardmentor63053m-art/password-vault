import React, { useState } from 'react';
import { completeLoginMfa, loginUser } from '../services/api';

export default function Login({ onLoginSuccess, onNavigateRegister }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [challenge, setChallenge] = useState(null);
  const [verificationCode, setVerificationCode] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (challenge && verificationCode.length !== 6) {
      setStatusMessage({ type: 'error', text: 'Enter the six-digit verification code.' });
      return;
    }
    if (!challenge && (!identifier.trim() || !password)) {
      setStatusMessage({ type: 'error', text: 'Please enter your username/email and password.' });
      return;
    }

    setLoading(true);
    setStatusMessage(null);

    const result = challenge
      ? await completeLoginMfa({ challengeId: challenge.challengeId, code: verificationCode })
      : await loginUser({ identifier, password });
    setLoading(false);

    if (result.success) {
      if (result.challenge) {
        setChallenge(result.challenge);
        setPassword('');
        setVerificationCode('');
        setStatusMessage({
          type: 'info',
          text: result.challenge.method === 'EMAIL'
            ? `Enter the six-digit code sent to ${result.challenge.maskedEmail}.`
            : 'Enter the current six-digit code from your authenticator app.',
        });
        return;
      }
      const user = result.data.user || { username: identifier.split('@')[0], email: identifier };
      setStatusMessage({
        type: 'success',
        text: 'Login successful! Redirecting to the demo vault...',
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
      text: `${provider} sign-in is not connected in this demo.`,
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
              Local Authentication & Vault Demo
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
              <span>Sample credential vault demo</span>
            </div>
            <div className="feature-item">
              <i className="fa-solid fa-key"></i>
              <span>Account passwords hashed with BCrypt</span>
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
              <h1 className="form-heading">{challenge ? 'Verify it’s you' : 'Welcome Back'}</h1>
              <p className="form-subheading">{challenge?.method === 'EMAIL'
                ? `A verification code was sent to ${challenge.maskedEmail}.`
                : challenge ? 'Enter the current code from your authenticator app.'
                  : 'Sign in to view the sample vault'}</p>
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
              {challenge ? (
                <div className="input-field-group">
                  <label htmlFor="mfa-code">Six-digit verification code</label>
                  <div className="input-wrapper">
                    <i className="fa-solid fa-shield-halved input-icon"></i>
                    <input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="000000" value={verificationCode} onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))} required />
                  </div>
                </div>
              ) : <>
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
                  <label htmlFor="password">Account Password</label>
                  <button
                    type="button"
                    className="forgot-link"
                    onClick={() =>
                      setStatusMessage({
                        type: 'info',
                        text: 'Password reset is not implemented in this demo.',
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
                    placeholder="Enter your account password"
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

              </>}

              <button type="submit" className="primary-action-btn" disabled={loading || (challenge && verificationCode.length !== 6)}>
                {loading ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i> Authenticating...
                  </>
                ) : (
                  <>
                    <i className={`fa-solid ${challenge ? 'fa-shield-check' : 'fa-lock-open'}`}></i> {challenge ? 'Verify and continue' : 'Unlock Vault'}
                  </>
                )}
              </button>
            </form>

            {challenge && <button type="button" className="mfa-back-button" onClick={() => { setChallenge(null); setVerificationCode(''); setIdentifier(''); setStatusMessage(null); }}>Back to sign in</button>}

            {!challenge && <><div className="form-divider">
              <span>Social sign-in preview</span>
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
            </>}
          </div>
        </main>
      </div>
    </div>
  );
}
