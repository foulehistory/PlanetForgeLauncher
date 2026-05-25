import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { API_BASE } from "../config";

type ImageKind = "banner" | "cover";
type SectionType = "hero" | "slider" | "grid";

type HomeItem = {
  id: string;
  game_id: number | null;
  title?: string;
  subtitle?: string;
  badge?: string;
  image_kind: ImageKind;
};

type HomeSection = {
  id: string;
  type: SectionType;
  title: string;
  subtitle?: string;
  columns: number;
  background?: string;
  items: HomeItem[];
};

type HomeConfig = {
  version: number;
  theme: {
    background: string;
    surface: string;
    accent: string;
  };
  sections: HomeSection[];
};

type HomeLayoutResponse = {
  config: HomeConfig;
  updated_at: string | null;
};

type CatalogGame = {
  id: number;
  title: string;
  genre: string | null;
  cover_image: string | null;
  banner_image: string | null;
  price: number;
  discount: number;
  is_free: boolean;
  is_free_this_week: boolean;
  is_featured: boolean;
};

const EMPTY_CONFIG: HomeConfig = {
  version: 1,
  theme: {
    background: "var(--bg-base)",
    surface: "var(--bg-surface)",
    accent: "var(--accent)",
  },
  sections: [],
};

function mediaUrl(gameId: number, kind: ImageKind): string {
  return `${API_BASE}/api/games/${gameId}/${kind}`;
}

function fmtPrice(game: CatalogGame): string {
  if (game.is_free || game.is_free_this_week) return "Gratuit";
  if (game.discount > 0) {
    const discounted = game.price * (1 - game.discount / 100);
    return `${discounted.toFixed(2)} €`;
  }
  return `${game.price.toFixed(2)} €`;
}

export default function Home() {
  const location = useLocation();
  const navigate = useNavigate();
  const fromAuth = location.state?.fromAuth === true;
  const [showOverlay, setShowOverlay] = useState(fromAuth);
  const [config, setConfig] = useState<HomeConfig>(EMPTY_CONFIG);
  const [games, setGames] = useState<CatalogGame[]>([]);
  const [loading, setLoading] = useState(true);

  const radius = useMotionValue(0);
  const maskImage = useTransform(radius, (r) =>
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

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const [layoutRes, gamesRes] = await Promise.all([
          fetch(`${API_BASE}/api/games/home-layout`),
          fetch(`${API_BASE}/api/games`),
        ]);

        if (layoutRes.ok) {
          const layout = await layoutRes.json() as HomeLayoutResponse;
          setConfig(layout.config ?? EMPTY_CONFIG);
        } else {
          setConfig(EMPTY_CONFIG);
        }

        if (gamesRes.ok) {
          setGames(await gamesRes.json());
        } else {
          setGames([]);
        }
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, []);

  const gamesById = useMemo(() => {
    const map = new Map<number, CatalogGame>();
    games.forEach((g) => map.set(g.id, g));
    return map;
  }, [games]);

  const openGame = (gameId: number | null) => {
    if (!gameId) return;
    navigate(`/shop/${gameId}`);
  };

  return (
    <div style={{ position: "relative", background: config.theme.background }}>
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

      <div className="page" style={{ gap: 14 }}>
        {loading ? (
          <div className="page-loading"><span className="spinner" /> Chargement...</div>
        ) : config.sections.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">🧩</div>
            <p>Home non configurée. Configure-la depuis le dashboard admin.</p>
          </div>
        ) : (
          config.sections.map((section) => {
            const sectionBg = section.background || config.theme.surface;

            if (section.type === "hero") {
              const item = section.items[0];
              const game = item?.game_id ? gamesById.get(item.game_id) : undefined;
              const title = item?.title || game?.title || section.title;
              const subtitle = item?.subtitle || game?.genre || section.subtitle || "";

              return (
                <div key={section.id} className="card" style={{ padding: 0, overflow: "hidden", background: sectionBg }}>
                  <div
                    style={{
                      minHeight: 260,
                      position: "relative",
                      cursor: game ? "pointer" : "default",
                      background: "linear-gradient(145deg, rgba(18,29,56,.9), rgba(7,11,20,.92))",
                    }}
                    onClick={() => openGame(game?.id ?? null)}
                  >
                    {game && (
                      <img
                        src={mediaUrl(game.id, item?.image_kind ?? "banner")}
                        alt={title}
                        style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }}
                      />
                    )}
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,.22), rgba(0,0,0,.75))" }} />
                    <div style={{ position: "relative", zIndex: 1, padding: 22, color: "#fff" }}>
                      <h2 style={{ marginBottom: 8 }}>{title}</h2>
                      {subtitle && <p style={{ marginBottom: 10, maxWidth: 620 }}>{subtitle}</p>}
                      {item?.badge && <span className="badge badge-blue">{item.badge}</span>}
                    </div>
                  </div>
                </div>
              );
            }

            if (section.type === "slider") {
              return (
                <div key={section.id} className="card" style={{ background: sectionBg }}>
                  <div className="page-header" style={{ marginBottom: 10 }}>
                    <h3>{section.title}</h3>
                    {section.subtitle && <p>{section.subtitle}</p>}
                  </div>

                  <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
                    {section.items.map((item) => {
                      const game = item.game_id ? gamesById.get(item.game_id) : undefined;
                      if (!game) return null;
                      const title = item.title || game.title;
                      return (
                        <button
                          key={item.id}
                          onClick={() => openGame(game.id)}
                          style={{
                            minWidth: 260,
                            flex: "0 0 260px",
                            border: "1px solid var(--border)",
                            borderRadius: 12,
                            overflow: "hidden",
                            background: "var(--bg-surface)",
                            textAlign: "left",
                            cursor: "pointer",
                            padding: 0,
                          }}
                        >
                          <div style={{ height: 130, background: "#0f172a" }}>
                            <img src={mediaUrl(game.id, item.image_kind)} alt={title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          </div>
                          <div style={{ padding: 10 }}>
                            <div className="card-title">{title}</div>
                            <div className="card-subtitle">{item.subtitle || game.genre || ""}</div>
                            <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              {item.badge ? <span className="badge badge-accent">{item.badge}</span> : <span />}
                              <span style={{ fontWeight: 600, color: config.theme.accent }}>{fmtPrice(game)}</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            }

            const columns = Math.max(1, Math.min(6, section.columns || 3));
            return (
              <div key={section.id} className="card" style={{ background: sectionBg }}>
                <div className="page-header" style={{ marginBottom: 10 }}>
                  <h3>{section.title}</h3>
                  {section.subtitle && <p>{section.subtitle}</p>}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(160px, 1fr))`, gap: 10 }}>
                  {section.items.map((item) => {
                    const game = item.game_id ? gamesById.get(item.game_id) : undefined;
                    if (!game) return null;
                    const title = item.title || game.title;
                    return (
                      <div
                        key={item.id}
                        className="card"
                        style={{ padding: 0, overflow: "hidden", cursor: "pointer" }}
                        onClick={() => openGame(game.id)}
                      >
                        <div style={{ height: 100, background: "#0f172a" }}>
                          <img src={mediaUrl(game.id, item.image_kind)} alt={title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </div>
                        <div style={{ padding: 10 }}>
                          <div className="card-title" style={{ fontSize: 13 }}>{title}</div>
                          <div className="card-subtitle">{item.subtitle || game.genre || ""}</div>
                          {item.badge && <span className="badge badge-success" style={{ marginTop: 6 }}>{item.badge}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
