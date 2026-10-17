import React, { useState } from 'react';
import { registerUser } from '../services/api';

const calculatePasswordStrength = (pwd) => {
  if (!pwd) return { score: 0, label: 'None', color: '#64748b', percent: 0 };
  let score = 0;
  if (pwd.length >= 8) score += 1;
  if (pwd.length >= 12) score += 1;
  if (/[A-Z]/.test(pwd)) score += 1;
  if (/[0-9]/.test(pwd)) score += 1;
  if (/[^A-Za-z0-9]/.test(pwd)) score += 1;

  if (score <= 1) return { score, label: 'Weak', color: '#ef4444', percent: 25 };
  if (score <= 3) return { score, label: 'Medium', color: '#f59e0b', percent: 60 };
  if (score <= 4) return { score, label: 'Strong', color: '#10b981', percent: 85 };
  return { score, label: 'Very Strong', color: '#06b6d4', percent: 100 };
};

export default function Register({ onRegisterSuccess, onNavigateLogin }) {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    role: 'ROLE_USER',
    password: '',
    confirmPassword: '',
    masterKeyNotice: true,
    agreeTerms: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const strength = calculatePasswordStrength(formData.password);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    // Clear field-specific error
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Enter a valid email address';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (formData.confirmPassword !== formData.password) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!formData.agreeTerms) {
      newErrors.agreeTerms = 'You must agree to the Terms of Service';
    }

    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    setStatusMessage(null);

    const result = await registerUser({
      username: formData.username,
      email: formData.email,
      password: formData.password,
    });

    setLoading(false);

    if (result.success) {
      setStatusMessage({
        type: 'success',
        text: result.message || 'Account created successfully! Redirecting to login...',
      });
      setTimeout(() => {
        onRegisterSuccess();
      }, 1200);
    } else {
      setStatusMessage({
        type: 'error',
        text: result.error || 'Registration failed. Please check your information.',
      });
    }
  };

  return (
    <div className="auth-card-wrapper">
      <div className="auth-card">
        {/* Left Branding Panel */}
        <aside className="auth-brand-panel">
          <div className="brand-header">
            <div className="brand-logo-badge">
              <i className="fa-solid fa-shield-halved"></i>
            </div>
            <h2 className="brand-title">SecureVault</h2>
            <p className="brand-subtitle">Create Your Master Encrypted Vault</p>
          </div>

          <div className="shield-illustration">
            <svg viewBox="0 0 200 200" className="shield-vector" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
              </defs>
              <path
                d="M100 20 L160 50 C160 120, 100 170, 100 170 C100 170, 40 120, 40 50 Z"
                fill="none"
                stroke="url(#shieldGrad)"
                strokeWidth="6"
              />
              <path
                d="M100 45 L140 65 C140 115, 100 150, 100 150 C100 150, 60 115, 60 65 Z"
                fill="rgba(59, 130, 246, 0.15)"
                stroke="rgba(255, 255, 255, 0.4)"
                strokeWidth="2"
              />
              <circle cx="100" cy="95" r="14" fill="#38bdf8" />
              <path d="M100 109 L100 125" stroke="#38bdf8" strokeWidth="5" strokeLinecap="round" />
            </svg>
          </div>

          <div className="zero-knowledge-box">
            <div className="zk-title">
              <i className="fa-solid fa-lock"></i> Zero-Knowledge Architecture
            </div>
            <p className="zk-desc">
              Your master password is never sent in plain text. A unique PBKDF2 salt is generated per account,
              ensuring only you can decrypt your credentials.
            </p>
          </div>

          <div className="brand-footer-text">
            <span>Infosys Springboard &bull; Team 3</span>
          </div>
        </aside>

        {/* Right Registration Form */}
        <main className="auth-form-panel">
          <div className="form-content-area">
            <header className="form-header">
              <h1 className="form-heading">Create an Account</h1>
              <p className="form-subheading">Setup your private, zero-knowledge password vault</p>
            </header>

            {statusMessage && (
              <div className={`status-banner ${statusMessage.type}`}>
                <i
                  className={`fa-solid ${
                    statusMessage.type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'
                  }`}
                ></i>
                <span>{statusMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="input-field-group">
                <label htmlFor="reg-username">Username</label>
                <div className="input-wrapper">
                  <i className="fa-regular fa-user input-icon"></i>
                  <input
                    id="reg-username"
                    name="username"
                    type="text"
                    placeholder="e.g. jdoe_sec"
                    value={formData.username}
                    onChange={handleChange}
                    autoComplete="username"
                    required
                  />
                </div>
                {errors.username && <span className="field-error">{errors.username}</span>}
              </div>

              <div className="input-field-group">
                <label htmlFor="reg-email">Email Address</label>
                <div className="input-wrapper">
                  <i className="fa-regular fa-envelope input-icon"></i>
                  <input
                    id="reg-email"
                    name="email"
                    type="email"
                    placeholder="name@company.com"
                    value={formData.email}
                    onChange={handleChange}
                    autoComplete="email"
                    required
                  />
                </div>
                {errors.email && <span className="field-error">{errors.email}</span>}
              </div>

              <div className="input-field-group">
                <label htmlFor="reg-role">System Role (RBAC)</label>
                <div className="input-wrapper">
                  <i className="fa-solid fa-shield-cat input-icon"></i>
                  <select
                    id="reg-role"
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    className="select-input"
                  >
                    <option value="ROLE_USER">Individual Vault User (ROLE_USER)</option>
                    <option value="ROLE_TEAM_MEMBER">Team Collaborator (ROLE_TEAM_MEMBER)</option>
                    <option value="ROLE_ADMIN">Vault Administrator (ROLE_ADMIN)</option>
                  </select>
                </div>
              </div>

              <div className="input-field-group">
                <label htmlFor="reg-password">Master Password</label>
                <div className="input-wrapper">
                  <i className="fa-solid fa-key input-icon"></i>
                  <input
                    id="reg-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="At least 8 characters with numbers & symbols"
                    value={formData.password}
                    onChange={handleChange}
                    autoComplete="new-password"
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
                {errors.password && <span className="field-error">{errors.password}</span>}

                {/* Password Strength Indicator */}
                {formData.password && (
                  <div className="strength-meter-container">
                    <div className="strength-bar-bg">
                      <div
                        className="strength-bar-fill"
                        style={{
                          width: `${strength.percent}%`,
                          backgroundColor: strength.color,
                        }}
                      ></div>
                    </div>
                    <div className="strength-label-row">
                      <span>Password Strength:</span>
                      <strong style={{ color: strength.color }}>{strength.label}</strong>
                    </div>
                  </div>
                )}
              </div>

              <div className="input-field-group">
                <label htmlFor="reg-confirm">Confirm Master Password</label>
                <div className="input-wrapper">
                  <i className="fa-solid fa-check-double input-icon"></i>
                  <input
                    id="reg-confirm"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Re-enter master password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    <i className={`fa-regular ${showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
                {errors.confirmPassword && <span className="field-error">{errors.confirmPassword}</span>}
              </div>

              <div className="consent-checkbox-list">
                <label className="checkbox-control">
                  <input
                    type="checkbox"
                    name="agreeTerms"
                    checked={formData.agreeTerms}
                    onChange={handleChange}
                  />
                  <span>
                    I agree to the <a href="#terms" className="inline-link">Terms of Service</a> and{' '}
                    <a href="#privacy" className="inline-link">Security Policies</a>
                  </span>
                </label>
                {errors.agreeTerms && <span className="field-error">{errors.agreeTerms}</span>}
              </div>

              <button type="submit" className="primary-action-btn" disabled={loading}>
                {loading ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i> Initializing Vault...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-user-shield"></i> Complete Registration
                  </>
                )}
              </button>
            </form>

            <footer className="form-footer">
              <p>
                Already registered?{' '}
                <button type="button" className="switch-auth-link" onClick={onNavigateLogin}>
                  Sign in to Vault
                </button>
              </p>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
