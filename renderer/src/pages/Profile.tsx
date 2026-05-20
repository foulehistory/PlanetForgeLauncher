import { Gamepad2, Clock, Calendar, Pencil, Check, X, Trophy, Copy, Users } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { API_BASE } from "../config";
import { useI18n } from "../shared/i18n";

interface ProfileData {
  id: number;
  username: string;
  email: string;
  display_name: string | null;
  avatar_path: string | null;
  friend_code: string | null;
  created_at: string;
  games_count: number;
  total_playtime_minutes: number;
}

function getToken(): string | null {
  const rememberMe = localStorage.getItem("remember-me") === "true";
  return (rememberMe ? localStorage : sessionStorage).getItem("auth-token");
}

function getInitials(name: string): string {
  return name
    .split(/[\s_]+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function clearTokens() {
  const rememberMe = localStorage.getItem("remember-me") === "true";
  const storage = rememberMe ? localStorage : sessionStorage;
  storage.removeItem("auth-token");
  storage.removeItem("refresh-token");
  storage.removeItem("auth-expires-at");
  storage.removeItem("refresh-expires-at");
  localStorage.removeItem("remember-me");
}

export default function Profile() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [profile, setProfile]     = useState<ProfileData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(false);
  const [editing, setEditing]     = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving]       = useState(false);

  useEffect(() => {
    const load = async () => {
      const token = getToken();
      if (!token) { setError(true); setLoading(false); return; }
      try {
        const res = await fetch(`${API_BASE}/api/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401 || res.status === 404) {
          clearTokens();
          navigate("/", { replace: true });
          return;
        }
        if (!res.ok) { setError(true); setLoading(false); return; }
        const data: ProfileData = await res.json();
        setProfile(data);
        setDisplayName(data.display_name ?? "");
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    const token = getToken();
    try {
      const res = await fetch(`${API_BASE}/api/users/me`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: displayName }),
      });
      if (res.ok) {
        setProfile({ ...profile, display_name: displayName.trim() || null });
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const [copied, setCopied] = useState(false);

  const copyFriendCode = () => {
    if (!profile?.friend_code) return;
    navigator.clipboard.writeText(profile.friend_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="page" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
        <span style={{ color: "var(--text-muted)", fontSize: 13 }}>Chargement...</span>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="page" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
        <span style={{ color: "var(--color-danger)", fontSize: 13 }}>Impossible de charger le profil.</span>
      </div>
    );
  }

  const displayedName    = profile.display_name || profile.username;
  const initials         = getInitials(displayedName);
  const playtimeHours    = Math.floor(profile.total_playtime_minutes / 60);
  const memberDate       = new Date(profile.created_at).toLocaleDateString(undefined, {
    year: "numeric", month: "long",
  });

  return (
    <motion.div
      className="page"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div className="card" style={{ display: "flex", alignItems: "center", gap: 24, padding: "28px 32px", marginBottom: 14 }}>

        {/* Avatar */}
        <div style={{
          width: 80, height: 80, borderRadius: "50%",
          background: "var(--accent-dim)",
          border: "2px solid var(--accent)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, fontSize: 26, fontWeight: 700,
          color: "var(--accent)", letterSpacing: "0.05em",
          userSelect: "none",
        }}>
          {initials}
        </div>

        {/* Infos */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Nom éditable */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            {editing ? (
              <>
                <input
                  className="input"
                  style={{ maxWidth: 260, height: 34, fontSize: 15 }}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={50}
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") { setEditing(false); setDisplayName(profile.display_name ?? ""); } }}
                />
                <button className="btn btn-primary btn-icon" onClick={handleSave} disabled={saving} title={t.profileSaveChanges}>
                  <Check size={13} />
                </button>
                <button className="btn btn-ghost btn-icon" onClick={() => { setEditing(false); setDisplayName(profile.display_name ?? ""); }} title="Annuler">
                  <X size={13} />
                </button>
              </>
            ) : (
              <>
                <span style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)" }}>
                  {displayedName}
                </span>
                <button
                  className="btn btn-ghost btn-icon"
                  onClick={() => setEditing(true)}
                  title={t.profileEditDisplayName}
                  style={{ opacity: 0.5 }}
                >
                  <Pencil size={12} />
                </button>
              </>
            )}
          </div>

          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 2 }}>
            @{profile.username}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
            {profile.email}
          </div>

          {/* Code ami */}
          {profile.friend_code && (
            <button
              onClick={copyFriendCode}
              title={copied ? "Copie !" : "Copier le code ami"}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                background: "var(--bg-overlay)",
                border: `1px solid ${copied ? "var(--color-success)" : "var(--border)"}`,
                borderRadius: "var(--radius-sm)",
                padding: "3px 8px", marginBottom: 8,
                cursor: "pointer",
                color: copied ? "var(--color-success)" : "var(--text-muted)",
                fontSize: 11, fontFamily: "monospace", letterSpacing: "0.08em",
                transition: "border-color 0.2s, color 0.2s",
              }}
            >
              <Users size={10} />
              {profile.friend_code}
              {copied ? <Check size={10} /> : <Copy size={10} />}
            </button>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--text-muted)" }}>
            <Calendar size={11} />
            {t.profileMemberSince} {memberDate}
          </div>
        </div>
      </div>

      {/* ── Stats ────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        <div className="stat">
          <div className="stat-value" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
            <Gamepad2 size={15} style={{ color: "var(--accent)" }} />
            {profile.games_count}
          </div>
          <div className="stat-label">{t.profileGamesOwned}</div>
        </div>

        <div className="stat">
          <div className="stat-value" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
            <Clock size={15} style={{ color: "var(--accent)" }} />
            {playtimeHours}{t.profileHours}
          </div>
          <div className="stat-label">{t.profileTotalPlaytime}</div>
        </div>

        <div className="stat">
          <div className="stat-value" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
            <Trophy size={15} style={{ color: "var(--accent)" }} />
            0
          </div>
          <div className="stat-label">{t.profileAchievements}</div>
        </div>
      </div>

    </motion.div>
  );
}
