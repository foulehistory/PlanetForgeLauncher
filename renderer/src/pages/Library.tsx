import { LibraryBig, Play, DownloadCloud, Clock3, ArrowRight, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../config";
import { useI18n } from "../shared/i18n";

type LibraryGame = {
  id: number;
  title: string;
  genre: string | null;
  cover_image: string | null;
  banner_image: string | null;
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

function mediaUrl(gameId: number, kind: "cover" | "banner"): string {
  return `${API_BASE}/api/games/${gameId}/${kind}`;
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
  const [installingId, setInstallingId] = useState<number | null>(null);
  const [launchingId, setLaunchingId] = useState<number | null>(null);
  const [uninstallingId, setUninstallingId] = useState<number | null>(null);

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
          <div className="page-loading"><span className="spinner" /> Chargement...</div>
        ) : games.length === 0 ? (
          <div className="empty"><div className="empty-icon">📚</div><p>Ta bibliotheque est vide.</p></div>
        ) : (
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))" }}>
            {games.map((g) => (
              <div
                key={g.id}
                onClick={() => navigate(`/library/${g.id}`)}
                style={{
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  overflow: "hidden",
                  background: "linear-gradient(160deg, rgba(255,255,255,.03), rgba(255,255,255,.01))",
                  cursor: "pointer",
                }}
              >
                <div style={{ position: "relative", height: 150, background: "#141d30" }}>
                  {g.banner_image ? (
                    <img src={mediaUrl(g.id, "banner")} alt={g.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontSize: 30 }}>🎮</div>
                  )}
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,.15) 0%, rgba(0,0,0,.78) 100%)" }} />

                  <div style={{ position: "absolute", left: 10, right: 10, bottom: 10, display: "grid", gridTemplateColumns: "62px 1fr auto", gap: 10, alignItems: "end" }}>
                    <div style={{ width: 62, height: 84, borderRadius: 8, overflow: "hidden", border: "1px solid rgba(255,255,255,.22)", background: "rgba(0,0,0,.4)" }}>
                      {g.cover_image ? (
                        <img src={mediaUrl(g.id, "cover")} alt={`${g.title} cover`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center" }}>🕹️</div>
                      )}
                    </div>
                    <div>
                      <div style={{ color: "#fff", fontWeight: 700 }}>{g.title}</div>
                      <div style={{ marginTop: 4, display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {g.genre && <span className="badge badge-accent">{g.genre}</span>}
                        {g.version && <span className="badge badge-muted">v{g.version}</span>}
                      </div>
                    </div>
                    {g.is_installed ? <span className="badge badge-success">Installe</span> : <span className="badge badge-muted">Non installe</span>}
                  </div>
                </div>

                <div style={{ padding: 12 }}>
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
                      <>
                        <button
                          className="btn btn-primary"
                          disabled={launchingId === g.id || uninstallingId === g.id}
                          onClick={async (ev) => {
                            ev.stopPropagation();
                            const token = getToken();
                            if (!token) {
                              navigate("/");
                              return;
                            }
                            if (!g.install_path) {
                              setError("Chemin d'installation introuvable pour ce jeu.");
                              return;
                            }

                            setError("");
                            setLaunchingId(g.id);
                            try {
                              const res = await window.api.playGame({
                                gameId: g.id,
                                gameTitle: g.title,
                                token,
                                installPath: g.install_path,
                                executablePath: g.executable_path,
                              });
                              if (!res.success && res.error) {
                                setError(res.error);
                              }
                            } finally {
                              setLaunchingId(null);
                            }
                          }}
                        >
                          <Play size={14} /> {launchingId === g.id ? "Lancement..." : "Jouer"}
                        </button>

                        <button
                          className="btn btn-ghost"
                          disabled={uninstallingId === g.id || launchingId === g.id}
                          onClick={async (ev) => {
                            ev.stopPropagation();
                            const token = getToken();
                            if (!token) {
                              navigate("/");
                              return;
                            }
                            if (!g.install_path) {
                              setError("Chemin d'installation introuvable pour ce jeu.");
                              return;
                            }
                            const ok = window.confirm(`Desinstaller ${g.title} ?`);
                            if (!ok) return;

                            setError("");
                            setUninstallingId(g.id);
                            try {
                              const res = await window.api.uninstallGame({
                                gameId: g.id,
                                token,
                                installPath: g.install_path,
                              });
                              if (res.success) {
                                setGames(prev => prev.map(item => (
                                  item.id === g.id
                                    ? {
                                        ...item,
                                        is_installed: false,
                                        install_path: null,
                                        installed_version: null,
                                      }
                                    : item
                                )));
                              } else if (res.error) {
                                setError(res.error);
                              }
                            } finally {
                              setUninstallingId(null);
                            }
                          }}
                        >
                          <Trash2 size={14} /> {uninstallingId === g.id ? "Desinstallation..." : "Desinstaller"}
                        </button>
                      </>
                    ) : (
                      <button
                        className="btn btn-ghost"
                        disabled={installingId === g.id}
                        onClick={async (ev) => {
                          ev.stopPropagation();
                          const token = getToken();
                          if (!token) {
                            navigate("/");
                            return;
                          }
                          setInstallingId(g.id);
                          try {
                            const res = await window.api.installGame({
                              gameId: g.id,
                              gameTitle: g.title,
                              token,
                              version: g.version,
                            });
                            if (res.success) {
                              setGames(prev => prev.map(item => (
                                item.id === g.id
                                  ? {
                                      ...item,
                                      is_installed: true,
                                      install_path: res.installPath ?? item.install_path,
                                      installed_version: g.version,
                                    }
                                  : item
                              )));
                            } else if (!res.cancelled && res.error) {
                              setError(res.error);
                            }
                          } finally {
                            setInstallingId(null);
                          }
                        }}
                      >
                        <DownloadCloud size={14} /> {installingId === g.id ? "Installation..." : "Installer"}
                      </button>
                    )}

                    <button className="btn btn-ghost" onClick={(ev) => { ev.stopPropagation(); navigate(`/shop/${g.id}`); }}>
                      Voir fiche <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
