import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, User, LogIn, UserPlus, Globe } from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import StatusAnimation, { type AnimationStatus } from "../shared/StatusAnimation";
import LaunchTransition from "../shared/LaunchTransition";
import { useI18n } from "../shared/i18n";

type Tab = "login" | "register";


// ─── Password strength ────────────────────────────────────────────────────────

function PasswordStrength({ password }: { password: string }) {
  const score = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;

  const color =
    score <= 1 ? "var(--color-danger)" :
    score <= 3 ? "var(--accent)" :
    "var(--color-success)";

  return (
    <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: 3,
            borderRadius: 2,
            background: i < score ? color : "var(--bg-overlay)",
            transition: "background 0.3s",
          }}
        />
      ))}
    </div>
  );
}

// ─── Input field ──────────────────────────────────────────────────────────────

function InputField({
  label, type = "text", placeholder, icon: Icon, value, onChange,
}: {
  label: string;
  type?: string;
  placeholder: string;
  icon: React.ElementType;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label className="input-label">{label}</label>
      <div className="input-wrapper">
        <Icon size={15} className="input-icon" />
        <input
          className="input"
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}

// ─── Login form ───────────────────────────────────────────────────────────────
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

function LoginForm({ onSuccess }: {
  onSuccess: () => void;
}) {
  const { t } = useI18n();
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [status, setStatus]         = useState<AnimationStatus>("idle");

const handleSubmit = async () => {
  setStatus("loading");

  const [result] = await Promise.all([
    window.api.login({ email, password, remember_me: rememberMe }),
    wait(900),
  ]);

  if (!result.ok || !result.data) {
    setStatus("error");
    await wait(2000);
    setStatus("idle");
    return;
  }

  const storage = rememberMe ? localStorage : sessionStorage;
  storage.setItem("auth-token",        result.data.access_token);
  storage.setItem("refresh-token",     result.data.refresh_token);
  storage.setItem("auth-expires-at",   result.data.access_expires_at);
  storage.setItem("refresh-expires-at", result.data.refresh_expires_at);
  localStorage.setItem("remember-me",  rememberMe ? "true" : "false");

  setStatus("success");
  await wait(1200);
  onSuccess();
};

  return (
    <motion.div
      key="login"
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      transition={{ duration: 0.18 }}
    >
      {status !== "idle" ? (
        <StatusAnimation
          status={status as Exclude<AnimationStatus, "idle">}
          loadingText={t.authLoginLoadingText}
          loadingSubtext={t.authLoginLoadingSubtext}
          successText={t.authLoginSuccessText}
          successSubtext={t.authLoginSuccessSubtext}
          errorText={t.authLoginErrorText}
          errorSubtext={t.authLoginErrorSubtext}
        />
      ) : (
        <>
          <InputField
            label={t.authEmailLabel}
            type="email"
            placeholder={t.authEmailPlaceholder}
            icon={Mail}
            value={email}
            onChange={setEmail}
          />
          <InputField
            label={t.authPasswordLabel}
            type="password"
            placeholder={t.authPasswordPlaceholder}
            icon={Lock}
            value={password}
            onChange={setPassword}
          />

          <div style={{ display: "flex", justifyContent: "flex-end", margin: "-8px 0 16px" }}>
            <a style={{ fontSize: 12, color: "var(--accent)", cursor: "pointer" }}>{t.authForgotPassword}</a>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, cursor: "pointer", userSelect: "none" }}>
            <span style={{
              position: "relative",
              width: 14,
              height: 14,
              borderRadius: "var(--radius-sm)",
              border: `1.5px solid ${rememberMe ? "var(--accent)" : "var(--border-hover)"}`,
              background: rememberMe ? "var(--accent)" : "var(--bg-elevated)",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.15s, border-color 0.15s",
            }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{ position: "absolute", opacity: 0, width: "100%", height: "100%", cursor: "pointer", margin: 0 }}
              />
              {rememberMe && (
                <svg width="9" height="7" viewBox="0 0 9 7" fill="none" style={{ pointerEvents: "none" }}>
                  <path d="M1 3.5L3.5 6L8 1" stroke="var(--bg-base)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{t.authRememberMe}</span>
          </label>

          <button
            className="btn btn-primary"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={handleSubmit}
            disabled={!email || !password}
          >
            <LogIn size={14} /> {t.authSignIn}
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0" }}>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{t.authOr}</span>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>

          <button className="btn btn-ghost" style={{ width: "100%", justifyContent: "center" }}>
            <Globe size={14} /> {t.authContinueWithGithub}
          </button>
        </>
      )}
    </motion.div>
  );
}
// ─── Register form ────────────────────────────────────────────────────────────

function RegisterForm({ onSuccess }: {
  onSuccess: () => void;
}) {
  const { t } = useI18n();
  const [username, setUsername]   = useState("");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
    const [status, setStatus] = useState<AnimationStatus>("idle");

  const handleSubmit = async () => {
    setStatus("loading");

    const [result] = await Promise.all([
      window.api.register({ username, email, password }),
      wait(900),
    ]);

    if (!result.ok || !result.data) {
      setStatus("error");
      await wait(2000);
      setStatus("idle");
      return;
    }

    sessionStorage.setItem("auth-token",         result.data.access_token);
    sessionStorage.setItem("refresh-token",      result.data.refresh_token);
    sessionStorage.setItem("auth-expires-at",    result.data.access_expires_at);
    sessionStorage.setItem("refresh-expires-at", result.data.refresh_expires_at);
    localStorage.setItem("remember-me", "false");

    setStatus("success");
    await wait(1200);
    onSuccess();
  };

  return (
    <motion.div
      key="register"
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.18 }}
    >
      {status !== "idle" ? (
        <StatusAnimation
          status={status as Exclude<AnimationStatus, "idle">}
          loadingText={t.authRegisterLoadingText}
          loadingSubtext={t.authRegisterLoadingSubtext}
          successText={t.authRegisterSuccessText}
          successSubtext={t.authRegisterSuccessSubtext}
          errorText={t.authRegisterErrorText}
          errorSubtext={t.authRegisterErrorSubtext}
        />
      ) : (
        <>
          <InputField
            label={t.authUsernameLabel}
            placeholder={t.authUsernamePlaceholder}
            icon={User}
            value={username}
            onChange={setUsername}
          />

          <InputField label={t.authEmailLabel} type="email" placeholder={t.authEmailPlaceholder} icon={Mail} value={email} onChange={setEmail} />

          <div style={{ marginBottom: 16 }}>
            <label className="input-label">{t.authPasswordLabel}</label>
            <div className="input-wrapper">
              <Lock size={15} className="input-icon" />
              <input
                className="input"
                type="password"
                placeholder={t.authPasswordPlaceholder}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {password && <PasswordStrength password={password} />}
          </div>

          <InputField label={t.authConfirmPasswordLabel} type="password" placeholder={t.authPasswordPlaceholder} icon={Lock} value={confirm} onChange={setConfirm} />

          {confirm && password !== confirm && (
            <p style={{ fontSize: 11, color: "var(--color-danger)", marginTop: -10, marginBottom: 12 }}>
              {t.authPasswordsDoNotMatch}
            </p>
          )}

          <button
            className="btn btn-primary"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={handleSubmit}
            disabled={!username || !email || password.length === 0 || password !== confirm}
          >
            <UserPlus size={14} /> {t.authCreateAccount}
          </button>
        </>
      )}
    </motion.div>
  );
}

// ─── Auth page ────────────────────────────────────────────────────────────────
export default function Auth() {
  const [tab, setTab]             = useState<Tab>("login");
  const [launching] = useState(false);
  const navigate                  = useNavigate();
  const { t } = useI18n();

  const _rememberMe = localStorage.getItem("remember-me") === "true";
  const _storage    = _rememberMe ? localStorage : sessionStorage;
  const token       = _storage.getItem("auth-token");
if (token && !launching) return <Navigate to="/home" replace />;

  const onSuccess = () => navigate("/home", { state: { fromAuth: true } });
  const onLaunchComplete = () => navigate("/home");

  return (
    <>
      {launching && <LaunchTransition onComplete={onLaunchComplete} />}

      <div style={{
        minHeight: "100vh",
        background: "var(--bg-base)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            width: "100%",
            maxWidth: 400,
            overflow: "hidden",
          }}
        >
          {/* Logo */}
          <div style={{ padding: "28px 28px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
              <div style={{
                width: 34, height: 34,
                background: "var(--accent-dim)",
                border: "1px solid rgba(0,180,216,0.3)",
                borderRadius: "var(--radius-md)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--accent)",
              }}>
                <Globe size={18} />
              </div>
              <span style={{ fontSize: 14, fontWeight: 500 }}>{t.appName}</span>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
              {(["login", "register"] as Tab[]).map((tabName) => (
                <button
                  key={tabName}
                  onClick={() => setTab(tabName)}
                  style={{
                    flex: 1,
                    padding: "10px 0",
                    background: "none",
                    border: "none",
                    borderBottom: `2px solid ${tab === tabName ? "var(--accent)" : "transparent"}`,
                    marginBottom: -1,
                    color: tab === tabName ? "var(--accent)" : "var(--text-muted)",
                    fontSize: 13,
                    cursor: "pointer",
                    transition: "color .15s, border-color .15s",
                  }}
                >
                  {tabName === "login" ? t.authSignIn : t.authCreateAccount}
                </button>
              ))}
            </div>
          </div>

          {/* Contenu */}
          <div style={{ padding: "24px 28px 28px" }}>
            <AnimatePresence mode="wait">
              {tab === "login"
                ? <LoginForm    key="login"    onSuccess={onSuccess} />
                : <RegisterForm key="register" onSuccess={onSuccess} />
              }
            </AnimatePresence>

            <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", marginTop: 16 }}>
              {tab === "login" ? (
                <>{t.authNoAccount}{" "}
                  <a style={{ color: "var(--accent)", cursor: "pointer" }} onClick={() => setTab("register")}>
                    {t.authCreateOne}
                  </a>
                </>
              ) : (
                <>{t.authAlreadyHaveAccount}{" "}
                  <a style={{ color: "var(--accent)", cursor: "pointer" }} onClick={() => setTab("login")}>
                    {t.authSignIn}
                  </a>
                </>
              )}
            </p>
          </div>
        </motion.div>
      </div>
    </>
  );
}