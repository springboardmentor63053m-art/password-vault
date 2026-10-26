import React, { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

export default function MfaSettingsPanel({ getStatus, startSetup, confirmSetup, disable }) {
  const [status, setStatus] = useState(null);
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [setupPassword, setSetupPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = async () => setStatus(await getStatus());
  useEffect(() => {
    let active = true;
    getStatus().then((result) => { if (active) setStatus(result); })
      .catch((requestError) => { if (active) setError(requestError.message); });
    return () => { active = false; };
  }, [getStatus]);

  const run = async (action, successMessage) => {
    setBusy(true); setError(""); setNotice("");
    try {
      await action();
      await refresh();
      setNotice(successMessage);
      return true;
    } catch (requestError) {
      setError(requestError.message || "The security setting could not be updated.");
      return false;
    } finally { setBusy(false); }
  };

  const beginSetup = async () => {
    setBusy(true); setError(""); setNotice("");
    try { setSetup(await startSetup(setupPassword)); setCode(""); }
    catch (requestError) { setError(requestError.message || "Authenticator setup could not be started."); }
    finally { setBusy(false); setSetupPassword(""); }
  };

  const confirm = async (event) => {
    event.preventDefault();
    if (await run(() => confirmSetup(code), "Authenticator app verification is now enabled.")) {
      setSetup(null); setCode("");
    }
  };

  const turnOff = async (event) => {
    event.preventDefault();
    if (await run(() => disable(password, code), "Authenticator verification has been disabled.")) {
      setPassword(""); setCode("");
    }
  };

  return (
    <section className="mfa-panel" aria-labelledby="mfa-panel-title">
      <div className="mfa-panel-heading">
        <span className="mfa-panel-icon"><i className="fa-solid fa-mobile-screen-button" /></span>
        <div><span className="mfa-eyebrow">ACCOUNT SECURITY</span><h2 id="mfa-panel-title">Multi-factor authentication</h2>
          <p>Use Google Authenticator or another TOTP app. New devices, IP addresses, and unusual login times also require email verification.</p></div>
        {status && <span className={`mfa-state ${status.totpEnabled ? "enabled" : "disabled"}`}><i />{status.totpEnabled ? "Authenticator on" : "Authenticator off"}</span>}
      </div>

      {error && <div className="mfa-message error" role="alert">{error}</div>}
      {notice && <div className="mfa-message success" role="status">{notice}</div>}

      {status?.totpEnabled ? (
        <form className="mfa-disable-form" onSubmit={turnOff}>
          <p>Authenticator codes are required at every sign-in. Email challenges are available for risky sign-ins: <strong>{status.emailChallengeAvailable ? status.maskedEmail : "email delivery is not configured"}</strong>.</p>
          <div className="mfa-fields"><label>Current password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required maxLength={72} /></label>
            <label>Authenticator code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit code" required /></label>
            <button type="submit" className="mfa-button secondary" disabled={busy || code.length !== 6 || !password}>{busy ? "Updating…" : "Disable authenticator"}</button></div>
        </form>
      ) : setup ? (
        <form className="mfa-setup-form" onSubmit={confirm}>
          <p>Add this account in Google Authenticator using the secret below, then enter the current six-digit code to finish setup. Keep the secret private.</p>
          <div className="mfa-qr-setup">
            <div className="mfa-qr-frame">
              <QRCodeSVG value={setup.otpauthUri} size={208} level="M" includeMargin title="Authenticator setup QR code" />
            </div>
            <div className="mfa-qr-copy">
              <strong>Scan to connect</strong>
              <span>In Google Authenticator, tap + and choose “Scan a QR code”. If you’re setting this up on the same device, use the manual key below.</span>
            </div>
          </div>
          <a className="mfa-otpauth-link" href={setup.otpauthUri}><i className="fa-solid fa-mobile-screen-button" /> Open in an authenticator app</a>
          <label className="mfa-secret-label">Manual setup key<code>{setup.secret}</code></label>
          <div className="mfa-fields"><label>Authenticator code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit code" required /></label>
            <button type="submit" className="mfa-button" disabled={busy || code.length !== 6}>{busy ? "Verifying…" : "Verify and enable"}</button>
            <button type="button" className="mfa-button secondary" onClick={() => { setSetup(null); setCode(""); }} disabled={busy}>Cancel setup</button></div>
        </form>
      ) : (
        <div className="mfa-enable-row"><div className="mfa-enable-copy"><p>{status?.emailChallengeAvailable ? `Email challenges can be sent to ${status.maskedEmail} when a sign-in looks unusual.` : "Email challenges are currently unavailable because SMTP is not configured."} Set up an authenticator app for protection at every sign-in.</p>
          <label className="mfa-enroll-password">Confirm your current password<input type="password" autoComplete="current-password" value={setupPassword} onChange={(event) => setSetupPassword(event.target.value)} maxLength={72} /></label></div>
          <button type="button" className="mfa-button" onClick={beginSetup} disabled={busy || !setupPassword}>{busy ? "Preparing…" : "Set up authenticator"}</button></div>
      )}
    </section>
  );
}
