import { Gamepad2, Clock, Calendar, Pencil, Check, X, Trophy, Copy, Users, Camera, Bell, Eye, Volume2, UserPlus } from "lucide-react";
import { useState, useEffect, useRef } from "react";
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
  avatar_url: string | null;
  friend_code: string | null;
  created_at: string;
  games_count: number;
  total_playtime_minutes: number;
  settings: UserSettings;
}

interface Achievement {
  id: number;
  category: string;
  metric: string;
  value: number;
  icon: string;
  title: string;
  description: string;
  earned_at: string | null;
}

interface UserSettings {
  notifications: {
    friend_request:  boolean;
    friend_online:   boolean;
    new_message:     boolean;
    sound_enabled:   boolean;
  };
  privacy: {
    show_online_status:    boolean;
    allow_friend_requests: boolean;
  };
}

const DEFAULT_SETTINGS: UserSettings = {
  notifications: { friend_request: true, friend_online: true, new_message: true, sound_enabled: true },
  privacy:       { show_online_status: true, allow_friend_requests: true },
};

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
  const [tab, setTab]             = useState<"profile" | "settings">("profile");
  const [editing, setEditing]     = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving]       = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [copied, setCopied]       = useState(false);
  const [settings, setSettings]   = useState<UserSettings>(DEFAULT_SETTINGS);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [achEarnedCount, setAchEarnedCount] = useState(0);
  const fileInputRef              = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      const token = getToken();
      if (!token) { setError(true); setLoading(false); return; }
      try {
        const [res, achRes] = await Promise.all([
          fetch(`${API_BASE}/api/users/me`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_BASE}/api/achievements/me`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (res.status === 401 || res.status === 404) {
          clearTokens();
          navigate("/", { replace: true });
          return;
        }
        if (!res.ok) { setError(true); setLoading(false); return; }
        const data: ProfileData = await res.json();
        setProfile(data);
        setDisplayName(data.display_name ?? "");
        setSettings(data.settings ?? DEFAULT_SETTINGS);
        if (achRes.ok) {
          const achData = await achRes.json();
          setAchievements(achData.all ?? []);
          setAchEarnedCount(achData.earned_count ?? 0);
        }
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

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setAvatarUploading(true);
    const token = getToken();
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch(`${API_BASE}/api/users/me/avatar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (res.ok) {
        const data = await res.json();
        setProfile({ ...profile, avatar_path: data.avatar_path, avatar_url: data.avatar_url });
      }
    } finally {
      setAvatarUploading(false);
      // Reset input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };


  const copyFriendCode = () => {
    if (!profile?.friend_code) return;
    navigator.clipboard.writeText(profile.friend_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveSettings = async () => {
    if (settingsSaving) return;
    setSettingsSaving(true);
    const token = getToken();
    try {
      await fetch(`${API_BASE}/api/users/me/settings`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
    } finally {
      setSettingsSaving(false);
    }
  };

  const setNotif = (key: keyof UserSettings["notifications"], value: boolean) =>
    setSettings((s) => ({ ...s, notifications: { ...s.notifications, [key]: value } }));

  const setPrivacy = (key: keyof UserSettings["privacy"], value: boolean) =>
    setSettings((s) => ({ ...s, privacy: { ...s.privacy, [key]: value } }));

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

      {/* ── Tab bar ──────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
        {(["profile", "settings"] as const).map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              height: 32, padding: "0 16px", borderRadius: "var(--radius-sm)",
              border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
              fontFamily: "inherit",
              background: tab === key ? "var(--accent)" : "var(--bg-overlay)",
              color:      tab === key ? "#fff"          : "var(--text-muted)",
              transition: "background 0.15s, color 0.15s",
            }}
          >
            {key === "profile" ? t.profileTabProfile : t.profileTabSettings}
          </button>
        ))}
      </div>

      {tab === "profile" && (<>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div className="card" style={{ display: "flex", alignItems: "center", gap: 24, padding: "28px 32px", marginBottom: 14 }}>

        {/* Avatar */}
        <div
          onClick={() => !avatarUploading && fileInputRef.current?.click()}
          title="Changer l'avatar"
          style={{
            position: "relative",
            width: 80, height: 80, borderRadius: "50%",
            background: "var(--accent-dim)",
            border: "2px solid var(--accent)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, fontSize: 26, fontWeight: 700,
            color: "var(--accent)", letterSpacing: "0.05em",
            userSelect: "none", cursor: avatarUploading ? "default" : "pointer",
            overflow: "hidden",
          }}
        >
          {profile.avatar_url ? (
            <img
              src={`${API_BASE}${profile.avatar_url}`}
              alt="Avatar"
              style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            initials
          )}
          {/* Camera overlay on hover */}
          <div className="avatar-upload-overlay" style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            background: "rgba(0,0,0,0.55)",
            display: "flex", alignItems: "center", justifyContent: "center",
            opacity: avatarUploading ? 1 : 0,
            transition: "opacity 0.18s",
          }}
            onMouseEnter={(e) => { if (!avatarUploading) (e.currentTarget as HTMLElement).style.opacity = "1"; }}
            onMouseLeave={(e) => { if (!avatarUploading) (e.currentTarget as HTMLElement).style.opacity = "0"; }}
          >
            <Camera size={22} color="white" />
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          style={{ display: "none" }}
          onChange={handleAvatarChange}
        />

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
              title={copied ? "Copié !" : "Copier le code ami"}
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
            {achEarnedCount}
          </div>
          <div className="stat-label">{t.profileAchievements}</div>
        </div>
      </div>

      </>)}

      {tab === "settings" && (
      <div className="card" style={{ padding: "20px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Paramètres</span>
          <button
            className="btn btn-primary"
            onClick={handleSaveSettings}
            disabled={settingsSaving}
            style={{ height: 28, fontSize: 11, padding: "0 12px" }}
          >
            {settingsSaving ? "..." : <><Check size={11} /> Sauvegarder</>}
          </button>
        </div>

        {/* Notifications */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <Bell size={12} style={{ color: "var(--accent)" }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Notifications</span>
          </div>
          <SettingRow label="Demandes d'amis"   desc="Recevoir une notification lors d'une nouvelle demande"  checked={settings.notifications.friend_request} onChange={(v) => setNotif("friend_request", v)} />
          <SettingRow label="Amis en ligne"     desc="Notifier quand un ami se connecte"                      checked={settings.notifications.friend_online}  onChange={(v) => setNotif("friend_online",  v)} />
          <SettingRow label="Nouveaux messages" desc="Notifier lors d'un message reçu"                        checked={settings.notifications.new_message}    onChange={(v) => setNotif("new_message",    v)} />
          <SettingRow label="Sons"              desc="Activer les sons de notifications"                      checked={settings.notifications.sound_enabled}  onChange={(v) => setNotif("sound_enabled",  v)} icon={<Volume2 size={12} />} last />
        </div>

        {/* Confidentialité */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <Eye size={12} style={{ color: "var(--accent)" }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Confidentialité</span>
          </div>
          <SettingRow label="Statut en ligne"      desc="Montrer aux amis quand vous êtes connecté"                  checked={settings.privacy.show_online_status}    onChange={(v) => setPrivacy("show_online_status",    v)} />
          <SettingRow label="Demandes d'amis"      desc="Autoriser les inconnus à vous envoyer une demande d'ami"    checked={settings.privacy.allow_friend_requests} onChange={(v) => setPrivacy("allow_friend_requests", v)} icon={<UserPlus size={12} />} last />
        </div>
      </div>
      )}

      {tab === "profile" && (<>
      {/* ── Achievements ─────────────────────────────────────────────── */}
      {achievements.length > 0 && (
        <div className="card" style={{ marginTop: 14, padding: "20px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Trophy size={14} style={{ color: "var(--accent)" }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Succès</span>
            </div>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {achEarnedCount} / {achievements.length}
            </span>
          </div>

          {/* Progress bar */}
          <div style={{ height: 4, background: "var(--bg-overlay)", borderRadius: 2, marginBottom: 16, overflow: "hidden" }}>
            <div style={{
              height: "100%", background: "var(--accent)", borderRadius: 2,
              width: `${achievements.length > 0 ? (achEarnedCount / achievements.length) * 100 : 0}%`,
              transition: "width 0.3s",
            }} />
          </div>

          {/* Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 8 }}>
            {achievements.map((a) => (
              <div
                key={a.id}
                title={`${a.title}\n${a.description}`}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center",
                  gap: 5, padding: "10px 8px",
                  background: "var(--bg-overlay)",
                  borderRadius: "var(--radius-sm)",
                  border: `1px solid ${a.earned_at ? "var(--accent)" : "var(--border)"}`,
                  opacity: a.earned_at ? 1 : 0.35,
                  transition: "opacity 0.15s",
                  position: "relative",
                }}
              >
                <span style={{ fontSize: 22, lineHeight: 1 }}>{a.icon}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-primary)", textAlign: "center", lineHeight: 1.3 }}>
                  {a.title}
                </span>
                {!a.earned_at && (
                  <span style={{ position: "absolute", top: 4, right: 4, fontSize: 9 }}>🔒</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      </>)}

    </motion.div>
  );
}

// ── Toggle + SettingRow helpers ───────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: 36, height: 20, borderRadius: 10, flexShrink: 0,
        background: checked ? "var(--accent)" : "var(--bg-overlay)",
        border: `1.5px solid ${checked ? "var(--accent)" : "var(--border)"}`,
        cursor: "pointer", position: "relative",
        transition: "background 0.18s, border-color 0.18s",
      }}
    >
      <div style={{
        position: "absolute", top: 2,
        left: checked ? 16 : 2,
        width: 14, height: 14, borderRadius: "50%",
        background: "white",
        transition: "left 0.18s",
        boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
      }} />
    </div>
  );
}

function SettingRow({ label, desc, checked, onChange, icon, last }: {
  label: string; desc?: string; checked: boolean;
  onChange: (v: boolean) => void; icon?: React.ReactNode; last?: boolean;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "7px 0",
      borderBottom: last ? "none" : "1px solid var(--border)",
      gap: 12,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 7, minWidth: 0 }}>
        {icon && <span style={{ color: "var(--text-muted)", marginTop: 1, flexShrink: 0 }}>{icon}</span>}
        <div>
          <div style={{ fontSize: 12, color: "var(--text-primary)" }}>{label}</div>
          {desc && <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>{desc}</div>}
        </div>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}
