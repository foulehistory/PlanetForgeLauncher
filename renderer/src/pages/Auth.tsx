import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, User, LogIn, UserPlus, Globe } from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import StatusAnimation, { type AnimationStatus } from "../shared/StatusAnimation";
import LaunchTransition from "../shared/LaunchTransition";

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
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus]     = useState<AnimationStatus>("idle");

const handleSubmit = async () => {
  setStatus("loading");

  const [result] = await Promise.all([
    window.api.login({ email, password }),
    wait(900),
  ]);

  if (!result.ok) {
    setStatus("error");
    await wait(2000);
    setStatus("idle");
    return;
  }

  localStorage.setItem("auth-token", result.data.access_token);
  setStatus("success");
  await wait(1200); // laisse l'animation success visible
  onSuccess();      // navigate ici, propre et prévisible
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
          loadingText="Authenticating…"
          loadingSubtext="Connecting to PlanetForge"
          successText="Welcome back!"
          successSubtext="Launching your launcher…"
          errorText="Login failed"
          errorSubtext="Invalid email or password"
        />
      ) : (
        <>
          <InputField
            label="Email"
            type="email"
            placeholder="you@example.com"
            icon={Mail}
            value={email}
            onChange={setEmail}
          />
          <InputField
            label="Password"
            type="password"
            placeholder="••••••••"
            icon={Lock}
            value={password}
            onChange={setPassword}
          />

          <div style={{ display: "flex", justifyContent: "flex-end", margin: "-8px 0 16px" }}>
            <a style={{ fontSize: 12, color: "var(--accent)", cursor: "pointer" }}>Forgot password?</a>
          </div>

          <button
            className="btn btn-primary"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={handleSubmit}
            disabled={!email || !password}
          >
            <LogIn size={14} /> Sign in
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0" }}>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>or</span>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>

          <button className="btn btn-ghost" style={{ width: "100%", justifyContent: "center" }}>
            <Globe size={14} /> Continue with GitHub
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
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
    const [status, setStatus] = useState<AnimationStatus>("idle");

  const handleSubmit = async () => {
    setStatus("loading");

    const [result] = await Promise.all([
      window.api.register({ username: `${firstName} ${lastName}`, email, password }),
      wait(900),
    ]);

    if (!result.ok) {
      setStatus("error");
      await wait(2000);
      setStatus("idle");
      return;
    }

    localStorage.setItem("auth-token", result.data.access_token);
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
          loadingText="Creating your account…"
          loadingSubtext="Setting up your profile"
          successText="Account created!"
          successSubtext="Welcome to PlanetForge"
          errorText="Registration failed"
          errorSubtext="Email already in use"
        />
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <InputField label="First name" placeholder="Alex" icon={User} value={firstName} onChange={setFirstName} />
            <InputField label="Last name"  placeholder="Dev"  icon={User} value={lastName}  onChange={setLastName} />
          </div>

          <InputField label="Email" type="email" placeholder="you@example.com" icon={Mail} value={email} onChange={setEmail} />

          <div style={{ marginBottom: 16 }}>
            <label className="input-label">Password</label>
            <div className="input-wrapper">
              <Lock size={15} className="input-icon" />
              <input
                className="input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {password && <PasswordStrength password={password} />}
          </div>

          <InputField label="Confirm password" type="password" placeholder="••••••••" icon={Lock} value={confirm} onChange={setConfirm} />

          {confirm && password !== confirm && (
            <p style={{ fontSize: 11, color: "var(--color-danger)", marginTop: -10, marginBottom: 12 }}>
              Passwords do not match
            </p>
          )}

          <button
            className="btn btn-primary"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={handleSubmit}
            disabled={!firstName || !lastName || !email || password.length === 0 || password !== confirm}
          >
            <UserPlus size={14} /> Create account
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

  const token = localStorage.getItem("auth-token");
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
              <span style={{ fontSize: 14, fontWeight: 500 }}>PlanetForge</span>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
              {(["login", "register"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    flex: 1,
                    padding: "10px 0",
                    background: "none",
                    border: "none",
                    borderBottom: `2px solid ${tab === t ? "var(--accent)" : "transparent"}`,
                    marginBottom: -1,
                    color: tab === t ? "var(--accent)" : "var(--text-muted)",
                    fontSize: 13,
                    cursor: "pointer",
                    transition: "color .15s, border-color .15s",
                  }}
                >
                  {t === "login" ? "Sign in" : "Create account"}
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
                <>No account?{" "}
                  <a style={{ color: "var(--accent)", cursor: "pointer" }} onClick={() => setTab("register")}>
                    Create one
                  </a>
                </>
              ) : (
                <>Already have an account?{" "}
                  <a style={{ color: "var(--accent)", cursor: "pointer" }} onClick={() => setTab("login")}>
                    Sign in
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