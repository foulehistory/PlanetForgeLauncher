import { ShoppingBag, ArrowLeft, Download, CheckCircle2, Sparkles, Shield } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE } from "../config";
import { useI18n } from "../shared/i18n";

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
  install_size_mb: number | null;
  version: string | null;
  release_date: string | null;
};

type GameDetail = CatalogGame & {
  description: string | null;
  developer: string | null;
  publisher: string | null;
  executable_path: string | null;
};

function getToken(): string | null {
  const rememberMe = localStorage.getItem("remember-me") === "true";
  return (rememberMe ? localStorage : sessionStorage).getItem("auth-token");
}

function mediaUrl(gameId: number, kind: "cover" | "banner"): string {
  return `${API_BASE}/api/games/${gameId}/${kind}`;
}

function fmtPrice(g: { is_free: boolean; is_free_this_week: boolean; discount: number; price: number }): string {
  if (g.is_free || g.is_free_this_week) return "Gratuit";
  if (g.discount > 0) {
    const discounted = g.price * (1 - g.discount / 100);
    return `${discounted.toFixed(2)} EUR`;
  }
  return `${g.price.toFixed(2)} EUR`;
}

function PriceBlock({ game }: { game: CatalogGame | GameDetail }) {
  if (game.is_free || game.is_free_this_week) return <span className="badge badge-green">Gratuit</span>;

  if (game.discount > 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="badge badge-orange">-{game.discount}%</span>
        <span style={{ textDecoration: "line-through", opacity: 0.6, fontSize: 12 }}>{game.price.toFixed(2)} EUR</span>
        <strong>{fmtPrice(game)}</strong>
      </div>
    );
  }
  return <strong>{fmtPrice(game)}</strong>;
}

export default function Shop() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { gameId } = useParams();
  const gameIdNum = useMemo(() => (gameId ? parseInt(gameId, 10) : null), [gameId]);

  const [games, setGames] = useState<CatalogGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [detail, setDetail] = useState<GameDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [inLibrary, setInLibrary] = useState(false);
  const [acquiring, setAcquiring] = useState(false);

  useEffect(() => {
    if (gameIdNum !== null) return;

    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${API_BASE}/api/games`);
        if (!res.ok) throw new Error("Impossible de charger le catalogue.");
        const data: CatalogGame[] = await res.json();
        setGames(data);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [gameIdNum]);

  useEffect(() => {
    if (gameIdNum === null || Number.isNaN(gameIdNum)) return;

    const token = getToken();
    const run = async () => {
      setDetailLoading(true);
      setError("");
      setInLibrary(false);
      try {
        const gameRes = await fetch(`${API_BASE}/api/games/${gameIdNum}`);
        if (!gameRes.ok) throw new Error("Jeu introuvable.");
        const gameData: GameDetail = await gameRes.json();
        setDetail(gameData);

        if (token) {
          const libRes = await fetch(`${API_BASE}/api/games/library/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (libRes.ok) {
            const lib: Array<{ id: number }> = await libRes.json();
            setInLibrary(lib.some((g) => g.id === gameData.id));
          }
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
        setDetail(null);
      } finally {
        setDetailLoading(false);
      }
    };

    void run();
  }, [gameIdNum]);

  async function acquireCurrentGame() {
    if (!detail) return;

    const token = getToken();
    if (!token) {
      navigate("/");
      return;
    }

    setAcquiring(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/games/${detail.id}/acquire`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || "Impossible d'ajouter le jeu a la bibliotheque.");
      }
      setInLibrary(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAcquiring(false);
    }
  }

  if (gameIdNum !== null) {
    return (
      <div className="page">
        <div className="card" style={{ padding: 18, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <button className="btn btn-ghost" onClick={() => navigate("/shop")}>
              <ArrowLeft size={14} /> Retour boutique
            </button>
            {detail && <PriceBlock game={detail} />}
          </div>

          {detailLoading ? (
            <div className="page-loading"><span className="spinner" /> Chargement…</div>
          ) : !detail ? (
            <div className="banner banner-error">{error || "Jeu introuvable."}</div>
          ) : (
            <>
              <div style={{
                position: "relative",
                minHeight: 260,
                borderRadius: 14,
                border: "1px solid var(--border)",
                overflow: "hidden",
                marginBottom: 14,
                background: "linear-gradient(120deg, #0f1728 0%, #1a2439 100%)",
              }}>
                {detail.banner_image && (
                  <img
                    src={mediaUrl(detail.id, "banner")}
                    alt={detail.title}
                    style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }}
                  />
                )}
                <div style={{
                  position: "absolute",
                  inset: 0,
                  background: "linear-gradient(180deg, rgba(0,0,0,.28) 0%, rgba(0,0,0,.78) 82%)",
                }} />

                <div style={{
                  position: "relative",
                  zIndex: 1,
                  height: "100%",
                  display: "grid",
                  gridTemplateColumns: "120px 1fr",
                  gap: 16,
                  alignItems: "end",
                  padding: 16,
                }}>
                  <div style={{
                    width: 120,
                    height: 168,
                    borderRadius: 12,
                    overflow: "hidden",
                    border: "1px solid rgba(255,255,255,.22)",
                    background: "rgba(0,0,0,.4)",
                    boxShadow: "0 14px 30px rgba(0,0,0,.45)",
                  }}>
                    {detail.cover_image ? (
                      <img src={mediaUrl(detail.id, "cover")} alt={`${detail.title} cover`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontSize: 36 }}>🎮</div>
                    )}
                  </div>

                  <div>
                    <h2 style={{ marginBottom: 8, color: "#fff", textShadow: "0 2px 14px rgba(0,0,0,.55)" }}>{detail.title}</h2>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                      {detail.genre && <span className="badge badge-blue">{detail.genre}</span>}
                      {detail.version && <span className="badge badge-gray">v{detail.version}</span>}
                      {detail.is_featured && <span className="badge badge-purple">Mis en avant</span>}
                      {detail.is_free_this_week && <span className="badge badge-green">Gratuit cette semaine</span>}
                    </div>
                    <p style={{ color: "rgba(255,255,255,.88)", margin: 0, maxWidth: 780 }}>
                      {detail.description || "Aucune description pour ce jeu."}
                    </p>
                  </div>
                </div>
              </div>

              {error && <div className="banner banner-error" style={{ marginBottom: 12 }}>{error}</div>}

              <div className="stat-row" style={{ marginBottom: 16 }}>
                <div className="stat-box"><div className="val">{detail.developer || "-"}</div><div className="lbl">Studio</div></div>
                <div className="stat-box"><div className="val">{detail.publisher || "-"}</div><div className="lbl">Editeur</div></div>
                <div className="stat-box"><div className="val">{detail.install_size_mb ? `${detail.install_size_mb} MB` : "-"}</div><div className="lbl">Taille</div></div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {inLibrary ? (
                  <button className="btn btn-ghost" onClick={() => navigate("/library")}>
                    <CheckCircle2 size={14} /> Deja dans ta bibliotheque
                  </button>
                ) : (
                  <button
                    className="btn btn-primary"
                    disabled={acquiring || (!detail.is_free && !detail.is_free_this_week)}
                    onClick={() => { void acquireCurrentGame(); }}
                  >
                    <Download size={14} />
                    {acquiring ? "Ajout..." : "Ajouter a ma bibliotheque"}
                  </button>
                )}
                <button className="btn btn-ghost" disabled>
                  <Shield size={14} /> Cloud save (bientot)
                </button>
              </div>

              {!detail.is_free && !detail.is_free_this_week && (
                <p style={{ marginTop: 10, fontSize: 12, color: "var(--text-muted)" }}>
                  Achat payant non implemente dans cette version du launcher.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ShoppingBag size={18} style={{ color: "var(--accent)" }} />
            <h2>{t.shopTitle}</h2>
          </div>
          <span className="badge badge-purple"><Sparkles size={12} /> Nouveautes</span>
        </div>
        <p style={{ marginBottom: 16 }}>{t.shopDescription}</p>

        {error && <div className="banner banner-error" style={{ marginBottom: 10 }}>{error}</div>}

        {loading ? (
          <div className="page-loading"><span className="spinner" /> Chargement…</div>
        ) : games.length === 0 ? (
          <div className="empty"><div className="empty-icon">🛒</div><p>Aucun jeu disponible.</p></div>
        ) : (
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))" }}>
            {games.map((g) => (
              <button
                key={g.id}
                onClick={() => navigate(`/shop/${g.id}`)}
                style={{
                  textAlign: "left",
                  cursor: "pointer",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  overflow: "hidden",
                  background: "linear-gradient(160deg, rgba(255,255,255,.03), rgba(255,255,255,.01))",
                  padding: 0,
                  transition: "transform .2s ease, border-color .2s ease",
                }}
              >
                <div style={{ position: "relative", height: 140, background: "#182134" }}>
                  {g.banner_image ? (
                    <img src={mediaUrl(g.id, "banner")} alt={g.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontSize: 30 }}>🎮</div>
                  )}
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,.1) 0%, rgba(0,0,0,.72) 100%)" }} />

                  <div style={{
                    position: "absolute", left: 10, right: 10, bottom: 10,
                    display: "grid", gridTemplateColumns: "58px 1fr auto", gap: 10, alignItems: "end",
                  }}>
                    <div style={{ width: 58, height: 78, borderRadius: 8, overflow: "hidden", border: "1px solid rgba(255,255,255,.22)", background: "rgba(0,0,0,.4)" }}>
                      {g.cover_image ? (
                        <img src={mediaUrl(g.id, "cover")} alt={`${g.title} cover`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontSize: 18 }}>🎯</div>
                      )}
                    </div>
                    <div>
                      <div style={{ color: "#fff", fontWeight: 700, textShadow: "0 2px 8px rgba(0,0,0,.5)" }}>{g.title}</div>
                      <div style={{ marginTop: 4, display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {g.genre && <span className="badge badge-blue">{g.genre}</span>}
                        {g.is_free_this_week && <span className="badge badge-green">Free this week</span>}
                      </div>
                    </div>
                    <div><PriceBlock game={g} /></div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
