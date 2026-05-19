import { Globe, LogOut, User, Users } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import UpdateBanner from "./UpdateBanner";
import { languageNames, languageOptions, type Language, useI18n } from "./i18n";
import { NotificationManager } from "./NotificationManager";
import { useNotification, useNotificationHelpers } from "./Notifications";
import FriendsPanel from "./FriendsPanel";
import { API_BASE, WS_BASE } from "../config";

function getToken(): string | null {
  const rememberMe = localStorage.getItem("remember-me") === "true";
  return (rememberMe ? localStorage : sessionStorage).getItem("auth-token");
}



export default function Layout() {
  const notify = useNotificationHelpers();
  const { addNotification } = useNotification();
  const navigate = useNavigate();
  const location = useLocation();
  const { language, setLanguage, t } = useI18n();
  const currentYear = new Date().getFullYear();
  const [friendsPanelOpen, setFriendsPanelOpen] = useState(false);
  const [friendsReloadKey, setFriendsReloadKey] = useState(0);

  // Track known request IDs to avoid duplicate notifications
  const knownRequestIds = useRef<Set<number>>(new Set());
  // Stable ref so polling closure always uses latest t (updated after every render)
  const tRef = useRef(t);
  useEffect(() => { tRef.current = t; });

  // Online user IDs tracked via WebSocket
  const [onlineUserIds, setOnlineUserIds] = useState<Set<number>>(new Set());
  // Mirror ref so the WS closure can read current online IDs without stale captures
  const onlineIdsRef    = useRef<Set<number>>(new Set());
  const offlineTimers   = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  useEffect(() => { onlineIdsRef.current = onlineUserIds; }, [onlineUserIds]);

  // ── WebSocket: presence + friend requests + real-time messages ────────────
  useEffect(() => {
    let ws: WebSocket | null = null;
    let ping: ReturnType<typeof setInterval> | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let alive = true;

    const connect = () => {
      const token = getToken();
      if (!token || !alive) return;

      ws = new WebSocket(`${WS_BASE}/api/ws?token=${encodeURIComponent(token)}`);

      ws.onopen = () => {
        ping = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
        }, 25_000);
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data as string) as Record<string, unknown>;
          // Broadcast to any subscriber (FriendsPanel listens here)
          window.dispatchEvent(new CustomEvent("ws:message", { detail: msg }));

          if (msg.type === "friends_online") {
            setOnlineUserIds(new Set(msg.online_ids as number[]));

          } else if (msg.type === "friend_status") {
            const uid = msg.user_id as number;
            if (msg.online) {
              // If there's a pending offline timer, this is a reconnect — cancel it silently
              const pending = offlineTimers.current.get(uid);
              if (pending !== undefined) {
                clearTimeout(pending);
                offlineTimers.current.delete(uid);
              } else if (!onlineIdsRef.current.has(uid)) {
                // Genuine offline → online transition: show notification
                addNotification({
                  type: "info",
                  title: tRef.current.friendsOnline,
                  message: (msg.display_name as string | null) || (msg.username as string),
                  duration: 5000,
                });
              }
              setOnlineUserIds((prev) => { const next = new Set(prev); next.add(uid); return next; });
            } else {
              // Delay offline removal — gives 3s grace for rapid reconnects (StrictMode / network blip)
              const timer = setTimeout(() => {
                setOnlineUserIds((prev) => { const next = new Set(prev); next.delete(uid); return next; });
                offlineTimers.current.delete(uid);
              }, 3000);
              offlineTimers.current.set(uid, timer);
            }

          } else if (msg.type === "friend_request") {
            const fid = msg.friendship_id as number;
            if (knownRequestIds.current.has(fid)) return;
            knownRequestIds.current.add(fid);
            const name = (msg.display_name as string | null) || (msg.username as string);
            addNotification({
              type:     "info",
              title:    tRef.current.friendsTabRequests,
              message:  name,
              duration: 0,
              actions: [
                {
                  label:   tRef.current.friendsAccept,
                  variant: "primary",
                  onClick: async () => {
                    const t2 = getToken();
                    if (!t2) return;
                    await fetch(`${API_BASE}/api/friends/${fid}/accept`, {
                      method: "PATCH", headers: { Authorization: `Bearer ${t2}` },
                    });
                    knownRequestIds.current.delete(fid);
                    setFriendsReloadKey((k) => k + 1);
                  },
                },
                {
                  label:   tRef.current.friendsDecline,
                  variant: "danger",
                  onClick: async () => {
                    const t2 = getToken();
                    if (!t2) return;
                    await fetch(`${API_BASE}/api/friends/${fid}/decline`, {
                      method: "PATCH", headers: { Authorization: `Bearer ${t2}` },
                    });
                    knownRequestIds.current.delete(fid);
                    setFriendsReloadKey((k) => k + 1);
                  },
                },
              ],
            });
          }
        } catch { /* ignore */ }
      };

      ws.onclose = () => {
        if (ping) { clearInterval(ping); ping = null; }
        if (alive) retry = setTimeout(connect, 3000);
      };

      ws.onerror = () => ws?.close();
    };

    connect();
    return () => {
      alive = false;
      if (ping)  clearInterval(ping);
      if (retry) clearTimeout(retry);
      ws?.close();
      offlineTimers.current.forEach(clearTimeout);
      offlineTimers.current.clear();
    };
  }, [addNotification]);

  const navItems = [
    { path: "/home", label: t.navHome },
    { path: "/shop", label: t.navShop },
    { path: "/library", label: t.navLibrary },
    { path: "/engine", label: t.navEngine },
  ];

  const handleSignOut = () => {
    const rememberMe = localStorage.getItem("remember-me") === "true";
    const storage    = rememberMe ? localStorage : sessionStorage;
    storage.removeItem("auth-token");
    storage.removeItem("refresh-token");
    storage.removeItem("auth-expires-at");
    storage.removeItem("refresh-expires-at");
    localStorage.removeItem("remember-me");
    navigate("/", { replace: true });
  };

  const handleLanguageChange = (nextLanguage: Language) => {
    if (nextLanguage === language) return;

    setLanguage(nextLanguage);
    notify.success(t.languageSwitchedTitle, `${t.languageLabel}: ${languageNames[nextLanguage]}`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>

      {/* Header */}
      <header style={{
        height: 48,
        background: "var(--bg-surface)",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap" }}>{t.appName}</span>
          <nav className="header-nav" aria-label="Primary">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  className={`header-nav-item${isActive ? " active" : ""}`}
                  onClick={() => navigate(item.path)}
                  aria-current={isActive ? "page" : undefined}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label className="language-select-group" title={t.languageLabel}>
            <Globe size={13} />
            <select
              className="language-select"
              value={language}
              onChange={(event) => handleLanguageChange(event.target.value as Language)}
              aria-label={t.languageLabel}
            >
              {languageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <button
            className="btn btn-ghost btn-header-action"
            style={{ color: location.pathname === "/profile" ? "var(--accent)" : undefined, borderColor: location.pathname === "/profile" ? "var(--accent)" : undefined }}
            onClick={() => navigate("/profile")}
          >
            <User size={13} /> {t.navProfile}
          </button>

          <button className="btn btn-ghost btn-header-action" onClick={handleSignOut}>
            <LogOut size={13} /> {t.signOut}
          </button>
        </div>
      </header>

      {/* Temporaire: banniere de mise a jour dans la zone du header */}
      <UpdateBanner />

      {/* Contenu de la page courante — animé sans démonter le Layout */}
      <main style={{ flex: 1, overflow: "auto" }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, scale: 1.03 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.18, ease: "easeInOut" }}
            style={{ width: "100%", height: "100%" }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer style={{
        minHeight: 36,
        background: "var(--bg-surface)",
        borderTop: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "0 16px",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span
            aria-hidden
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--color-success)",
              boxShadow: "0 0 0 4px rgba(62, 207, 142, 0.12)",
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {t.appName} {currentYear} · {t.connected}
          </span>
        </div>

        <span style={{ fontSize: 11, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
          {t.buildChannel}
        </span>

        {/* Bouton Amis */}
        <button
          className="btn btn-ghost btn-header-action"
          style={{
            color: friendsPanelOpen ? "var(--accent)" : undefined,
            borderColor: friendsPanelOpen ? "var(--accent)" : undefined,
            background: friendsPanelOpen ? "var(--accent-dim)" : undefined,
          }}
          onClick={() => setFriendsPanelOpen((o) => !o)}
        >
          <Users size={13} /> {t.navFriends}
        </button>
      </footer>

      <NotificationManager />

      <FriendsPanel isOpen={friendsPanelOpen} onClose={() => setFriendsPanelOpen(false)} reloadKey={friendsReloadKey} onlineUserIds={onlineUserIds} />

    </div>
  );
}
