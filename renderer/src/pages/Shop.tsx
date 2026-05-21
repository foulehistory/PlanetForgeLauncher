import { ShoppingBag, ArrowLeft, Download, CheckCircle2 } from "lucide-react";
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

function fmtPrice(g: { is_free: boolean; is_free_this_week: boolean; discount: number; price: number }): string {
  if (g.is_free || g.is_free_this_week) return "Gratuit";
  if (g.discount > 0) {
    const discounted = g.price * (1 - g.discount / 100);
    return `${discounted.toFixed(2)} EUR`;
  }
  return `${g.price.toFixed(2)} EUR`;
}

function PriceBlock({ game }: { game: CatalogGame | GameDetail }) {
  if (game.is_free || game.is_free_this_week) {
    return <span className="badge badge-green">Gratuit</span>;
  }
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
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
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
              <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 14 }}>
                <div style={{ width: 88, height: 88, borderRadius: 14, background: "var(--bg-surface)",
                  border: "1px solid var(--border)", display: "grid", placeItems: "center", fontSize: 30 }}>
                  {detail.cover_image ? (
                    <img src={detail.cover_image} alt={detail.title} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 14 }} />
                  ) : "🎮"}
                </div>
                <div>
                  <h2 style={{ marginBottom: 6 }}>{detail.title}</h2>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {detail.genre && <span className="badge badge-blue">{detail.genre}</span>}
                    {detail.version && <span className="badge badge-gray">v{detail.version}</span>}
                    {detail.is_featured && <span className="badge badge-purple">Mis en avant</span>}
                  </div>
                </div>
              </div>

              {error && <div className="banner banner-error" style={{ marginBottom: 12 }}>{error}</div>}

              <p style={{ color: "var(--text-secondary)", marginBottom: 16 }}>
                {detail.description || "Aucune description pour ce jeu."}
              </p>

              <div className="stat-row" style={{ marginBottom: 16 }}>
                <div className="stat-box"><div className="val">{detail.developer || "-"}</div><div className="lbl">Studio</div></div>
                <div className="stat-box"><div className="val">{detail.publisher || "-"}</div><div className="lbl">Editeur</div></div>
                <div className="stat-box"><div className="val">{detail.install_size_mb ? `${detail.install_size_mb} MB` : "-"}</div><div className="lbl">Taille</div></div>
              </div>

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
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <ShoppingBag size={18} style={{ color: "var(--accent)" }} />
          <h2>{t.shopTitle}</h2>
        </div>
        <p style={{ marginBottom: 16 }}>{t.shopDescription}</p>

        {error && <div className="banner banner-error" style={{ marginBottom: 10 }}>{error}</div>}

        {loading ? (
          <div className="page-loading"><span className="spinner" /> Chargement…</div>
        ) : games.length === 0 ? (
          <div className="empty"><div className="empty-icon">🛒</div><p>Aucun jeu disponible.</p></div>
        ) : (
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
            {games.map((g) => (
              <button
                key={g.id}
                className="card"
                onClick={() => navigate(`/shop/${g.id}`)}
                style={{ textAlign: "left", border: "1px solid var(--border)", padding: 12, cursor: "pointer" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 8 }}>
                  <strong style={{ fontSize: 14 }}>{g.title}</strong>
                  <PriceBlock game={g} />
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {g.genre && <span className="badge badge-blue">{g.genre}</span>}
                  {g.is_featured && <span className="badge badge-purple">Featured</span>}
                  {g.is_free_this_week && <span className="badge badge-green">Free this week</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
