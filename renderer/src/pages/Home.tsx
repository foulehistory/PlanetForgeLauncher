import { Download, Zap, ArrowRight, Globe, Sword, LogIn, Sparkles } from "lucide-react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";


const featuredFree = [
  { id: 1, title: "Aether Knights", genre: "RPG" },
  { id: 2, title: "Neon Circuit", genre: "Racing" },
  { id: 3, title: "Fortress Legacy", genre: "Strategy" },
];

const onSale = [
  { id: 1, title: "StarForge",   discount: 60, price: "7,99 €" },
  { id: 2, title: "Drone Wars X", discount: 40, price: "11,99 €" },
  { id: 3, title: "Dead Sector",  discount: 75, price: "4,99 €" },
  { id: 4, title: "Summit Run",   discount: 25, price: "14,99 €" },
];

const stats = [
  { value: "1 247", label: "Games in library" },
  { value: "3",     label: "Active downloads" },
  { value: "14",    label: "Friends online" },
  { value: "Free",  label: "This week's gift" },
];

export default function Home() {
  const location              = useLocation();
  const fromAuth              = location.state?.fromAuth === true;
  const navigate                  = useNavigate();
  const [showOverlay, setShowOverlay] = useState(fromAuth);

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
  }, []);

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
      {/* ── Hero ─────────────────────────────────────────────────────── */}

        <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" onClick={() => { 
                localStorage.removeItem("auth-token");
                navigate("/");
             }}>
            <LogIn size={14} /> Sign out
            </button>
            <button className="btn btn-ghost">Release notes</button>
        </div>

      <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "28px 32px", marginBottom: 28 }}>
        <div style={{ maxWidth: 460 }}>
          <div style={{ fontSize: 11, color: "var(--accent)", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <Zap size={13} /> New release
          </div>
          <h1 style={{ fontSize: 26, lineHeight: 1.25, marginBottom: 10 }}>
            PlanetForge Engine 2.0<br />is now available
          </h1>
          <p style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 20, maxWidth: 380 }}>
            Next-gen rendering, real-time ray tracing, and a fully reworked asset pipeline. Build faster, ship smarter.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary">
              <Download size={14} /> Download now
            </button>
            <button className="btn btn-ghost">Release notes</button>
          </div>
        </div>
        <div style={{ width: 160, height: 120, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Globe size={48} style={{ color: "var(--accent)", opacity: .3 }} />
        </div>
      </div>

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
          <h3>Featured &amp; free</h3>
          <button className="btn btn-ghost" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => navigate("/library")}>
            See all <ArrowRight size={12} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {/* Main featured card */}
          <div className="card" style={{ gridRow: "span 3", padding: 0, overflow: "hidden", cursor: "pointer" }}>
            <div style={{ height: 180, background: "var(--bg-overlay)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Globe size={40} style={{ color: "var(--text-muted)" }} />
            </div>
            <div style={{ padding: 12 }}>
              <div className="card-title">Void Recon: Origins</div>
              <div className="card-subtitle">Action · Sci-Fi · Open World</div>
              <div style={{ marginTop: 8 }}>
                <span className="badge badge-accent">Free this week</span>
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
                <div className="card-subtitle">{g.genre} · Free</div>
              </div>
              <span className="badge badge-accent">Free</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── On sale ──────────────────────────────────────────────────── */}
      <div className="section">
        <div className="page-header" style={{ marginBottom: 14 }}>
          <h3>On sale now</h3>
          <button className="btn btn-ghost" style={{ fontSize: 12, padding: "4px 10px" }}>
            Browse deals <ArrowRight size={12} />
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