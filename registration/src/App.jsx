import { useState } from 'react';

const initialFormData = {
  name: '',
  email: '',
  role: '',
  password: '',
  confirmPassword: '',
  agree: false,
};

const getPasswordStrength = (password) => {
  if (!password) return { score: 0, label: 'No password', className: 'empty' };

  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 1) return { score, label: 'Weak', className: 'weak' };
  if (score <= 2) return { score, label: 'Medium', className: 'medium' };
  if (score <= 3) return { score, label: 'Strong', className: 'strong' };
  return { score, label: 'Very strong', className: 'very-strong' };
};

function App() {
  const [visiblePasswords, setVisiblePasswords] = useState({
    password: false,
    confirmPassword: false,
  });

  const [formData, setFormData] = useState(initialFormData);
  const [errors, setErrors] = useState({});

  const validateField = (fieldName, values) => {
    switch (fieldName) {
      case 'name':
        return !values.name.trim() ? 'Full name is required.' : '';
      case 'email':
        if (!values.email.trim()) return 'Email is required.';
        return /\S+@\S+\.\S+/.test(values.email) ? '' : 'Please enter a valid email address.';
      case 'role':
        return !values.role ? 'Please select a role.' : '';
      case 'password':
        if (!values.password) return 'Password is required.';
        if (values.password.length < 6) return 'Password must be at least 6 characters.';
        return '';
      case 'confirmPassword':
        if (!values.confirmPassword) return 'Please confirm your password.';
        if (values.confirmPassword !== values.password) return 'Passwords do not match.';
        return '';
      case 'agree':
        return !values.agree ? 'You must agree to the Terms of Service.' : '';
      default:
        return '';
    }
  };

  const validateForm = () => {
    const nextErrors = {};
    Object.keys(initialFormData).forEach((field) => {
      const error = validateField(field, formData);
      if (error) nextErrors[field] = error;
    });
    return nextErrors;
  };

  const togglePassword = (field) => {
    setVisiblePasswords((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    const nextValues = {
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    };

    setFormData(nextValues);

    if (name === 'password' && nextValues.confirmPassword) {
      setErrors((prev) => ({
        ...prev,
        confirmPassword: validateField('confirmPassword', nextValues),
      }));
    }

    const fieldError = validateField(name, nextValues);
    setErrors((prev) => ({
      ...prev,
      [name]: fieldError,
    }));
  };

  const passwordStrength = getPasswordStrength(formData.password);

  const handleSubmit = (event) => {
    event.preventDefault();
    const validationErrors = validateForm();

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    alert('Registration submitted successfully!');
    setFormData(initialFormData);
  };

  return (
    <div className="page">
      <h1>Register Page</h1>

      <div className="register-card">
        <aside className="left-panel">
          <div className="brand">
            <div className="brand-badge" aria-hidden="true">
              <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
                <rect x="31" y="48" width="58" height="42" rx="10" fill="none" stroke="#f7f9fb" strokeWidth="6" />
                <path d="M43 48V36C43 23.85 52.85 14 65 14C77.15 14 87 23.85 87 36V48" fill="none" stroke="#f7f9fb" strokeWidth="6" strokeLinecap="round" />
                <path d="M51 59.5L60 68L81 47" fill="none" stroke="#f7f9fb" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="brand-title">SecureVault</div>
          </div>

          <div className="tagline">SecureVault: A Full-Stack Password Vault &amp; Credential Management System</div>

          <div className="shield-wrap" aria-hidden="true">
            <svg className="shield-svg" viewBox="0 0 340 270" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="shieldGlow" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                  <stop offset="100%" stopColor="#dfeeff" stopOpacity="1" />
                </linearGradient>
              </defs>
              <path d="M170 18C121 51 96 58 85 60C88 118 99 174 170 234C241 174 252 118 255 60C244 58 219 51 170 18Z" fill="none" stroke="url(#shieldGlow)" strokeWidth="10" />
              <path d="M170 42C135 62 115 71 109 73C111 116 120 158 170 206C220 158 229 116 231 73C225 71 205 62 170 42Z" fill="none" stroke="url(#shieldGlow)" strokeWidth="6" opacity="0.86" />
              <g fill="none" stroke="url(#shieldGlow)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M170 95c-19 18-28 31-32 50 6 16 15 24 32 34 17-10 26-18 32-34-4-19-13-32-32-50Z" opacity="0.9" />
                <path d="M146 125c11-10 22-16 24-28 2 12 13 18 24 28" />
                <path d="M146 158c8 7 18 12 24 18 6-6 16-11 24-18" />
                <path d="M135 87c10 10 19 16 35 16 16 0 25-6 35-16" />
                <path d="M150 94c-7 7-11 14-13 24 5 11 11 16 21 22" />
                <path d="M190 94c7 7 11 14 13 24-5 11-11 16-21 22" />
              </g>
            </svg>
          </div>

          <div className="brand-footer">
            <span className="main">PasswordVault</span>
            <span className="sub">Keep your Passwords Save!</span>
          </div>
        </aside>

        <main className="right-panel">
          <div className="form-area">
            <h2 className="form-title">Create an Account</h2>
            <p className="subtitle">manage your credentials securely</p>

            <form onSubmit={handleSubmit}>
              <div className={`field ${errors.name ? 'has-error' : ''}`}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="8" r="4"></circle>
                  <path d="M4 19c1.6-3.1 5.1-4.5 8-4.5S18.4 15.9 20 19"></path>
                </svg>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Full Name"
                />
                {errors.name && <small className="error-text">{errors.name}</small>}
              </div>

              <div className={`field ${errors.email ? 'has-error' : ''}`}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-9Z"></path>
                  <path d="M4.8 6.5 12 12l7.2-5.5"></path>
                </svg>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Email Address"
                />
                {errors.email && <small className="error-text">{errors.email}</small>}
              </div>

              <div className={`field ${errors.role ? 'has-error' : ''}`}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="9" cy="8" r="3"></circle>
                  <path d="M3.5 19c.7-3 2.7-4.5 5.5-4.5s4.8 1.5 5.5 4.5M16 8h5M18.5 5.5v5"></path>
                </svg>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  required
                >
                  <option value="" disabled>Select Role</option>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
                {errors.role && <small className="error-text">{errors.role}</small>}
              </div>

              <div className={`field ${errors.password ? 'has-error' : ''}`}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="5" y="11" width="14" height="9" rx="2"></rect>
                  <path d="M8 11V8.8A4 4 0 0 1 12 5a4 4 0 0 1 4 3.8V11"></path>
                </svg>
                <input
                  id="password"
                  type={visiblePasswords.password ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Password"
                />
                <button
                  className="password-toggle"
                  type="button"
                  aria-label={visiblePasswords.password ? 'Hide password' : 'Show password'}
                  onClick={() => togglePassword('password')}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"></path>
                    <circle cx="12" cy="12" r="3.2"></circle>
                  </svg>
                </button>
                {formData.password && (
                  <div className="password-strength" aria-live="polite">
                    <div className="strength-label">Password strength</div>
                    <div className="strength-bar">
                      <span className={`strength-fill ${passwordStrength.className}`} />
                    </div>
                    <small className={`strength-text ${passwordStrength.className}`}>
                      {passwordStrength.label}
                    </small>
                  </div>
                )}
                {errors.password && <small className="error-text">{errors.password}</small>}
              </div>

              <div className={`field ${errors.confirmPassword ? 'has-error' : ''}`}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="5" y="11" width="14" height="9" rx="2"></rect>
                  <path d="M8 11V8.8A4 4 0 0 1 12 5a4 4 0 0 1 4 3.8V11"></path>
                </svg>
                <input
                  id="confirmPassword"
                  type={visiblePasswords.confirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Confirm Password"
                />
                <button
                  className="password-toggle"
                  type="button"
                  aria-label={visiblePasswords.confirmPassword ? 'Hide password' : 'Show password'}
                  onClick={() => togglePassword('confirmPassword')}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"></path>
                    <circle cx="12" cy="12" r="3.2"></circle>
                  </svg>
                </button>
                {errors.confirmPassword && <small className="error-text">{errors.confirmPassword}</small>}
              </div>

              <div className={`checkbox-row ${errors.agree ? 'has-error' : ''}`}>
                <label>
                  <input
                    type="checkbox"
                    name="agree"
                    checked={formData.agree}
                    onChange={handleChange}
                  />
                  <span>I agree to Terms of Service and Privacy Policy</span>
                </label>
                {errors.agree && <small className="error-text checkbox-error">{errors.agree}</small>}
              </div>

              <button className="btn" type="submit">Register</button>
            </form>

            <p className="login-text">Already have an account? <a href="#">Login here</a></p>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
