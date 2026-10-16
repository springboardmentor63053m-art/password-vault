import React, { useState } from "react";
import "./App.css";

function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");

  const handleLogin = (event) => {
    event.preventDefault();

    if (!email.trim() || !password.trim()) {
      setMessage("Please enter your email and password.");
      return;
    }

    setMessage("Login page demo: backend authentication is not connected.");
  };

  const handleGoogleLogin = () => {
    setMessage("Google authentication needs to be configured.");
  };

  const handleMicrosoftLogin = () => {
    setMessage("Microsoft authentication needs to be configured.");
  };

  const handleForgotPassword = () => {
    setMessage("Password reset functionality can be added here.");
  };

  const handleRegister = () => {
    setMessage("Registration page can be connected here.");
  };

  return (
    <main className="login-page">
      <section className="login-container">
        <aside className="left-panel">
          <div className="brand-section">
            <div className="securevault-logo">
              <i className="fa-solid fa-user-lock securevault-icon"></i>
            </div>

            <h2 className="brand-name">SecureVault</h2>

            <p className="brand-description">
              Securely manage all your passwords and credentials in one place.
              Your digital identity, protected with confidence.
            </p>
          </div>

          <div className="password-vault-section">
            <div className="fingerprint-image">
              <i className="fa-solid fa-fingerprint fingerprint-icon"></i>
            </div>

            <h1 className="password-vault-title">PasswordVault</h1>

            <p className="password-vault-description">
              Keep Your Password Safe!
            </p>
          </div>
        </aside>

        <section className="right-panel">
          <div className="login-form-container">
            <header className="form-header">
              <h1>Welcome Back!</h1>

              <p>Sign in to your SecureVault Account</p>
            </header>

            <form onSubmit={handleLogin}>
              <div className="input-group">
                <label htmlFor="email" className="visually-hidden">
                  Email
                </label>

                <input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setMessage("");
                  }}
                  autoComplete="email"
                />
              </div>

              <div className="input-group password-group">
                <label htmlFor="password" className="visually-hidden">
                  Password
                </label>

                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setMessage("");
                  }}
                  autoComplete="current-password"
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>

              <div className="form-options">
                <label className="remember-label">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => {
                      setRememberMe(event.target.checked);
                    }}
                  />

                  <span>Remember me</span>
                </label>

                <button
                  type="button"
                  className="forgot-password"
                  onClick={handleForgotPassword}
                >
                  Forgot Password?
                </button>
              </div>

              <button type="submit" className="login-button">
                Login
              </button>
            </form>

            {message && (
              <p className="status-message" role="status">
                {message}
              </p>
            )}

            <div className="divider">
              <span></span>
              <p>or continue with</p>
              <span></span>
            </div>

            <div className="social-login-container">
              <button
                type="button"
                className="social-login-button"
                onClick={handleGoogleLogin}
              >
                <img
                  src="./images/google.png"
                  alt="Google"
                  className="social-logo"
                />

                <span>Continue With Google</span>
              </button>

              <button
                type="button"
                className="social-login-button"
                onClick={handleMicrosoftLogin}
              >
                <img
                  src="/images/microsoft.png"
                  alt="Microsoft"
                  className="social-logo"
                />

                <span>Continue With Microsoft</span>
              </button>
            </div>

            <footer className="register-section">
              <p>Don't you have an account?</p>

              <button
                type="button"
                className="register-link"
                onClick={handleRegister}
              >
                Register here
              </button>
            </footer>
          </div>
        </section>
      </section>
    </main>
  );
}

export default App;
