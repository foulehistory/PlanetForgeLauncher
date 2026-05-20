import { ArrowRight, Globe, Sword, Sparkles } from "lucide-react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useLocation, useOutletContext } from "react-router-dom";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../shared/i18n";


const featuredFree = [
  { id: 1, title: "Aether Knights", genre: "RPG" },
];

const onSale = [
  { id: 1, title: "StarForge",   discount: 60, price: "7,99 €" },
];

export default function Home() {
  const location              = useLocation();
  const fromAuth              = location.state?.fromAuth === true;
  const navigate                  = useNavigate();
  const { t } = useI18n();
  const [showOverlay, setShowOverlay] = useState(fromAuth);
  const { onlineCount = 0 } = useOutletContext<{ onlineCount: number }>();

  const stats = [
    { value: "0", label: t.statsGamesInLibrary },
    { value: "0", label: t.statsActiveDownloads },
    { value: String(onlineCount), label: t.statsFriendsOnline },
    { value: t.freeLabel, label: t.statsWeeklyGift },
  ];

  const radius    = useMotionValue(0);
  const maskImage = useTransform(radius, r =>
    `radial-gradient(circle ${r}px at 50% 50%, transparent ${r}px, black ${r}px)`
  );

  useEffect(() => {
    if (!fromAuth) return;
    const controls = animate(radius, 2000, {
      duration: 0.8,
      ease: [0.4, 0, 0.2, 1],
      onComplete: () => setShowOverlay(false),
    });
    return () => controls.stop();
  }, [fromAuth, radius]);

  return (
    <div style={{ position: "relative" }}>

      {showOverlay && (
        <motion.div
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--bg-base)",
            zIndex: 100,
            pointerEvents: "none",
            maskImage,
            WebkitMaskImage: maskImage,
          }}
        />
      )}

        <div className="page">

      {/* ── Stats ────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 28 }}>
        {stats.map((s) => (
          <div key={s.label} className="stat">
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Featured & free ──────────────────────────────────────────── */}
      <div className="section">
        <div className="page-header" style={{ marginBottom: 14 }}>
          <h3>{t.featuredAndFree}</h3>
          <button className="btn btn-ghost" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => navigate("/library")}>
            {t.seeAll} <ArrowRight size={12} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {/* Main featured card */}
          <div className="card" style={{ gridRow: "span 3", padding: 0, overflow: "hidden", cursor: "pointer" }}>
            <div style={{ height: 180, background: "var(--bg-overlay)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Globe size={40} style={{ color: "var(--text-muted)" }} />
            </div>
            <div style={{ padding: 12 }}>
              <div className="card-title">{t.featuredMainTitle}</div>
              <div className="card-subtitle">{t.featuredMainSubtitle}</div>
              <div style={{ marginTop: 8 }}>
                <span className="badge badge-accent">{t.freeThisWeek}</span>
              </div>
            </div>
          </div>

          {/* Side free games */}
          {featuredFree.map((g) => (
            <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: 10, cursor: "pointer" }}>
              <div style={{ width: 48, height: 48, background: "var(--bg-overlay)", borderRadius: "var(--radius-sm)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Sword size={20} style={{ color: "var(--text-muted)" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="card-title" style={{ fontSize: 13 }}>{g.title}</div>
                <div className="card-subtitle">{g.genre} · {t.freeLabel}</div>
              </div>
              <span className="badge badge-accent">{t.freeLabel}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── On sale ──────────────────────────────────────────────────── */}
      <div className="section">
        <div className="page-header" style={{ marginBottom: 14 }}>
          <h3>{t.onSaleNow}</h3>
          <button className="btn btn-ghost" style={{ fontSize: 12, padding: "4px 10px" }}>
            {t.browseDeals} <ArrowRight size={12} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
          {onSale.map((g) => (
            <div key={g.id} className="card" style={{ padding: 0, overflow: "hidden", cursor: "pointer" }}>
              <div style={{ height: 90, background: "var(--bg-overlay)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Sparkles size={28} style={{ color: "var(--text-muted)" }} />
              </div>
              <div style={{ padding: "8px 10px" }}>
                <div className="card-title" style={{ fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.title}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4 }}>
                  <span className="badge badge-success" style={{ fontSize: 11 }}>-{g.discount}%</span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>{g.price}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      </div>

    </div>
  );
}