import { Globe, LogOut } from "lucide-react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import UpdateBanner from "./UpdateBanner";
import { languageNames, languageOptions, type Language, useI18n } from "./i18n";
import { NotificationManager } from "./NotificationManager";
import { useNotificationHelpers } from "./Notifications";


export default function Layout() {
  const notify = useNotificationHelpers();
  const navigate = useNavigate();
  const location = useLocation();
  const { language, setLanguage, t } = useI18n();
  const currentYear = new Date().getFullYear();

  const navItems = [
    { path: "/home", label: t.navHome },
    { path: "/shop", label: t.navShop },
    { path: "/library", label: t.navLibrary },
    { path: "/engine", label: t.navEngine },
  ];

  const handleSignOut = () => {
    localStorage.removeItem("auth-token");
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

          <button className="btn btn-ghost btn-header-action" onClick={handleSignOut}>
            <LogOut size={13} /> {t.signOut}
          </button>
        </div>
      </header>

      {/* Temporaire: banniere de mise a jour dans la zone du header */}
      <UpdateBanner />

      {/* Contenu de la page courante */}
      <main style={{ flex: 1, overflow: "auto" }}>
        <Outlet />
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
      </footer>

      <NotificationManager />

    </div>
  );
}