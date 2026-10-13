import { useEffect, useState } from "react";
import { API_URL } from "../config";

function Login({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [databaseStatus, setDatabaseStatus] = useState("checking");
  const [emailVerificationConfigured, setEmailVerificationConfigured] = useState(false);
  const [healthAttempt, setHealthAttempt] = useState(0);
  const [verificationPending, setVerificationPending] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [resendMessage, setResendMessage] = useState("");

  useEffect(() => {
    let active = true;
    let retryTimer;
    setDatabaseStatus("checking");
    fetch(`${API_URL}/api/health`)
      .then((response) => response.json())
      .then((health) => {
        if (!active) return;
        const nextStatus = health.database === "connected" ? "connected" : "unavailable";
        setDatabaseStatus(nextStatus);
        setEmailVerificationConfigured(health.emailVerificationConfigured === true);
        if (nextStatus !== "connected") retryTimer = setTimeout(() => setHealthAttempt((attempt) => attempt + 1), 8000);
      })
      .catch(() => {
        if (!active) return;
        setDatabaseStatus("offline");
        retryTimer = setTimeout(() => setHealthAttempt((attempt) => attempt + 1), 8000);
      });
    return () => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [healthAttempt]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    if (mode === "signup" && !name.trim()) return setError("Enter your name.");
    if (!email.trim() || !password) return setError("Enter your email and password.");
    if (mode === "signup" && password.length < 8) return setError("Password must be at least 8 characters.");
    setBusy(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email: email.trim(), password }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Authentication failed.");
      if (mode === "signup" && result.verificationRequired) {
        setVerificationPending(result.email || email.trim());
        setVerificationCode("");
        setPassword("");
        setResendMessage(result.message || "Check your inbox for the 6-digit verification code.");
        return;
      }
      onAuthenticated(result);
    } catch (requestError) {
      const message = requestError instanceof TypeError
        ? `Cannot reach the backend at ${API_URL}. Start it from the project root with 'npm start'.`
        : requestError.message || "Backend is unavailable. Start the server and try again.";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const verifyEmailCode = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/api/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: verificationPending, code: verificationCode.trim() }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Email verification failed.");
      onAuthenticated(result);
    } catch (requestError) {
      setError(requestError.message || "Could not verify this code.");
    } finally {
      setBusy(false);
    }
  };

  const resendConfirmation = async () => {
    setBusy(true);
    setError("");
    setResendMessage("");
    setVerificationCode("");
    try {
      const response = await fetch(`${API_URL}/api/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: verificationPending }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not send a new confirmation link.");
      setResendMessage(result.message);
    } catch (requestError) {
      setError(requestError.message || "Could not resend the confirmation email.");
    } finally {
      setBusy(false);
    }
  };

  const connectionMessage = {
    checking: "Checking secure database…",
    connected: "Secure database connected",
    unavailable: "Database unavailable — check MongoDB setup",
    offline: "Backend is offline",
  }[databaseStatus];

  return (
    <main className="login-page">
      <section className="login-visual" aria-label="Datawise introduction">
        <div className="login-brand"><div className="brand-mark">D</div><strong>Datawise</strong></div>
        <div className="login-pitch">
          <span className="eyebrow">INTELLIGENCE FOR EVERY DECISION</span>
          <h1>Turn your data into a clearer next move.</h1>
          <p>Bring your business data together, understand the story behind it, and act with confidence.</p>
          <div className="login-mini-chart" aria-label="Illustrative workspace performance chart">
            <div className="mini-chart-label"><span>Workspace performance</span><strong>+24.8%</strong></div>
            <div className="mini-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
          </div>
        </div>
        <p className="login-copyright">© 2026 Datawise Analytics</p>
      </section>

      <section className="login-card" aria-labelledby="login-heading">
        <div className="login-card-head">
          <div className="login-status-row">
            <span className={`connection-status connection-${databaseStatus}`} role="status">
              <i aria-hidden="true"></i>{connectionMessage}
            </span>
            <button className="connection-refresh" type="button" onClick={() => setHealthAttempt((attempt) => attempt + 1)} aria-label="Check database connection again">↻</button>
          </div>
          <span className="eyebrow">{mode === "login" ? "WELCOME BACK" : "GET STARTED"}</span>
          <h2 id="login-heading">{mode === "login" ? "Sign in to your workspace" : "Create your workspace"}</h2>
          <p>{verificationPending ? "Enter the code sent to your email address to activate your account." : mode === "login" ? "Use your registered account to continue." : "We’ll email you a code to verify your address."}</p>
        </div>

        {verificationPending ? (
          <div className="verification-pending" role="status">
            <span className="verification-icon">✉</span>
            <strong>Check your inbox</strong>
            <p>We sent a 6-digit code to <b>{verificationPending}</b>. Your account opens after the code is verified.</p>
            {resendMessage && <p>{resendMessage}</p>}
            {error && <p className="form-error" role="alert">{error}</p>}
            <form onSubmit={verifyEmailCode}>
              <label htmlFor="verification-code">Email verification code
                <input id="verification-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="000000" value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))} required />
              </label>
              <button className="login-button" type="submit" disabled={busy || verificationCode.length !== 6}>
                {busy ? "Verifying…" : "Verify code"}<span aria-hidden="true">→</span>
              </button>
            </form>
            <button className="resend-code-button" type="button" onClick={resendConfirmation} disabled={busy}>Resend code</button>
          </div>
        ) : <form onSubmit={handleSubmit}>
          {mode === "signup" && (
            <label htmlFor="account-name">Full name
              <input id="account-name" type="text" placeholder="Your name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" maxLength={80} required />
            </label>
          )}
          <label htmlFor="account-email">Email address
            <input id="account-email" type="email" placeholder="you@company.com" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
          </label>
          <label htmlFor="account-password">Password
            <span className="password-field">
              <input id="account-password" type={showPassword ? "text" : "password"} placeholder={mode === "signup" ? "8–72 characters" : "Your password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={mode === "signup" ? 8 : undefined} maxLength={72} required />
              <button className="password-toggle" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "Hide" : "Show"}</button>
            </span>
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="login-button" type="submit" disabled={busy || databaseStatus !== "connected"}>
            {busy ? "Connecting…" : mode === "login" ? "Sign in" : "Create account"}<span aria-hidden="true">→</span>
          </button>
          {databaseStatus !== "connected" && <p className="database-hint">Sign-in and account creation need a live MongoDB connection. Your data will not be stored in temporary accounts.</p>}
          {mode === "signup" && !emailVerificationConfigured && <p className="database-hint">Email verification is not configured yet. Add the SMTP settings in the backend .env before creating accounts.</p>}
        </form>
        }

        <p className="auth-switch">
          {mode === "login" ? "New to Datawise?" : "Already have an account?"}{" "}
          <button type="button" onClick={() => { setVerificationPending(""); setVerificationCode(""); setResendMessage(""); setMode(mode === "login" ? "signup" : "login"); setError(""); }}>
            {mode === "login" ? "Create account" : "Sign in"}
          </button>
        </p>
        <p className="login-note">Passwords are securely hashed. Sessions are stored and can be revoked.</p>
      </section>
    </main>
  );
}

export default Login;
