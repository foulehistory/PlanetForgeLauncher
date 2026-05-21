import { LibraryBig, Play, DownloadCloud, Clock3 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../config";
import { useI18n } from "../shared/i18n";

type LibraryGame = {
  id: number;
  title: string;
  genre: string | null;
  cover_image: string | null;
  version: string | null;
  executable_path: string | null;
  install_size_mb: number | null;
  is_installed: boolean;
  install_path: string | null;
  installed_version: string | null;
  last_played_at: string | null;
  playtime_minutes: number;
  purchased_at: string | null;
};

function getToken(): string | null {
  const rememberMe = localStorage.getItem("remember-me") === "true";
  return (rememberMe ? localStorage : sessionStorage).getItem("auth-token");
}

function fmtPlaytime(minutes: number): string {
  if (!minutes) return "0h";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

export default function Library() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [games, setGames] = useState<LibraryGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getToken();
    if (!token) {
      navigate("/");
      return;
    }

    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${API_BASE}/api/games/library/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Impossible de charger ta bibliotheque.");
        const data: LibraryGame[] = await res.json();
        setGames(data);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [navigate]);

  return (
    <div className="page">
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <LibraryBig size={18} style={{ color: "var(--accent)" }} />
          <h2>{t.libraryTitle}</h2>
        </div>
        <p style={{ marginBottom: 14 }}>{t.libraryDescription}</p>

        {error && <div className="banner banner-error" style={{ marginBottom: 10 }}>{error}</div>}

        {loading ? (
          <div className="page-loading"><span className="spinner" /> Chargement…</div>
        ) : games.length === 0 ? (
          <div className="empty"><div className="empty-icon">📚</div><p>Ta bibliotheque est vide.</p></div>
        ) : (
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
            {games.map((g) => (
              <div key={g.id} className="card" style={{ border: "1px solid var(--border)", padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 8 }}>
                  <strong style={{ fontSize: 14 }}>{g.title}</strong>
                  {g.is_installed ? (
                    <span className="badge badge-green">Installe</span>
                  ) : (
                    <span className="badge badge-gray">Non installe</span>
                  )}
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                  {g.genre && <span className="badge badge-blue">{g.genre}</span>}
                  {g.version && <span className="badge badge-purple">v{g.version}</span>}
                </div>

                <div style={{ display: "grid", gap: 6, marginBottom: 12, fontSize: 12, color: "var(--text-secondary)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Clock3 size={13} /> Temps de jeu: {fmtPlaytime(g.playtime_minutes)}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <DownloadCloud size={13} /> Taille: {g.install_size_mb ? `${g.install_size_mb} MB` : "-"}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {g.is_installed ? (
                    <button className="btn btn-primary" disabled>
                      <Play size={14} /> Jouer (bientot)
                    </button>
                  ) : (
                    <button className="btn btn-ghost" disabled>
                      <DownloadCloud size={14} /> Installer (bientot)
                    </button>
                  )}

                  <button className="btn btn-ghost" onClick={() => navigate(`/shop/${g.id}`)}>
                    Voir fiche
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
