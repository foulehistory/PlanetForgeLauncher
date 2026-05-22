import { ArrowLeft, Clock3, DownloadCloud, Play, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE } from "../config";

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

type GameTrophy = {
  id: string;
  game_id: number;
  trophy_type: string | null;
  icon: string;
  title: string;
  description: string;
  earned_at: string | null;
  unlocked: boolean;
};

type TrophyFilter = "all" | "unlocked" | "locked";

const TROPHY_ORDER = ["platine", "or", "argent", "bronze"] as const;
const TROPHY_LABELS: Record<(typeof TROPHY_ORDER)[number], string> = {
  bronze: "Bronze",
  argent: "Argent",
  or: "Or",
  platine: "Platine",
};
const TROPHY_COLORS: Record<(typeof TROPHY_ORDER)[number], string> = {
  bronze: "#cd7f32",
  argent: "#c0c0c0",
  or: "#ffd700",
  platine: "#b4d5ff",
};

function normalizeTrophyType(type: string | null): (typeof TROPHY_ORDER)[number] {
  if (type === "bronze" || type === "argent" || type === "or" || type === "platine") return type;
  return "bronze";
}

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

function fmtLastPlayed(iso: string | null): string {
  if (!iso) return "Jamais";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Jamais";
  return d.toLocaleString();
}

function fmtUnlockedDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

export default function LibraryGame() {
  const navigate = useNavigate();
  const { gameId } = useParams<{ gameId: string }>();
  const [game, setGame] = useState<LibraryGame | null>(null);
  const [trophies, setTrophies] = useState<GameTrophy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [installing, setInstalling] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [uninstalling, setUninstalling] = useState(false);
  const [trophyFilter, setTrophyFilter] = useState<TrophyFilter>("all");
  const [justUnlockedIds, setJustUnlockedIds] = useState<string[]>([]);

  const parsedGameId = Number(gameId ?? "0");

  useEffect(() => {
    const token = getToken();
    if (!token) {
      navigate("/");
      return;
    }
    if (!parsedGameId || Number.isNaN(parsedGameId)) {
      setError("Identifiant de jeu invalide.");
      setLoading(false);
      return;
    }

    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const [libRes, trRes] = await Promise.all([
          fetch(`${API_BASE}/api/games/library/me`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_BASE}/api/achievements/me/game/${parsedGameId}`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        if (!libRes.ok) throw new Error("Impossible de charger la bibliothèque.");
        if (!trRes.ok) throw new Error("Impossible de charger les trophées du jeu.");

        const library: LibraryGame[] = await libRes.json();
        const current = library.find(g => g.id === parsedGameId) ?? null;
        if (!current) throw new Error("Ce jeu n'est pas dans ta bibliothèque.");

        const trData: GameTrophy[] = await trRes.json();
        setGame(current);
        setTrophies(trData);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [navigate, parsedGameId]);

  useEffect(() => {
    const handler = (event: Event) => {
      if (!game) return;
      const msg = (event as CustomEvent<Record<string, unknown>>).detail;
      if (!msg || msg.type !== "achievement_unlocked") return;

      const achievement = msg.achievement as Partial<GameTrophy> | undefined;
      if (!achievement?.id || achievement.game_id !== game.id) return;

      setTrophies(prev => prev.map(t => (
        t.id === achievement.id
          ? { ...t, unlocked: true, earned_at: t.earned_at ?? new Date().toISOString() }
          : t
      )));

      setJustUnlockedIds(prev => (prev.includes(achievement.id as string) ? prev : [...prev, achievement.id as string]));
      setTimeout(() => {
        setJustUnlockedIds(prev => prev.filter(id => id !== achievement.id));
      }, 2200);
    };

    window.addEventListener("ws:message", handler);
    return () => window.removeEventListener("ws:message", handler);
  }, [game]);

  const sortedTrophies = useMemo(() => {
    const list = [...trophies].sort((a, b) => {
      const aType = normalizeTrophyType(a.trophy_type);
      const bType = normalizeTrophyType(b.trophy_type);
      const typeDelta = TROPHY_ORDER.indexOf(aType) - TROPHY_ORDER.indexOf(bType);
      if (typeDelta !== 0) return typeDelta;
      if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
      return a.title.localeCompare(b.title);
    });

    return list.filter((trophy) => {
      if (trophyFilter === "unlocked") return trophy.unlocked;
      if (trophyFilter === "locked") return !trophy.unlocked;
      return true;
    });
  }, [trophies, trophyFilter]);

  const unlockedCount = trophies.filter(t => t.unlocked).length;
  const overallPercent = trophies.length > 0 ? Math.round((unlockedCount / trophies.length) * 100) : 0;

  const trophyStats = TROPHY_ORDER.map((type) => {
    const all = trophies.filter(t => normalizeTrophyType(t.trophy_type) === type);
    const unlocked = all.filter(t => t.unlocked);
    const percent = all.length > 0 ? Math.round((unlocked.length / all.length) * 100) : 0;
    return { type, total: all.length, unlocked: unlocked.length, percent };
  });

  async function installGame() {
    if (!game) return;
    const token = getToken();
    if (!token) {
      navigate("/");
      return;
    }
    setInstalling(true);
    setError("");
    try {
      const res = await window.api.installGame({ gameId: game.id, gameTitle: game.title, token, version: game.version });
      if (res.success) {
        setGame(prev => prev ? {
          ...prev,
          is_installed: true,
          install_path: res.installPath ?? prev.install_path,
          installed_version: prev.version,
        } : prev);
      } else if (!res.cancelled && res.error) {
        setError(res.error);
      }
    } finally {
      setInstalling(false);
    }
  }

  async function playGame() {
    if (!game) return;
    const token = getToken();
    if (!token) {
      navigate("/");
      return;
    }
    if (!game.install_path) {
      setError("Chemin d'installation introuvable pour ce jeu.");
      return;
    }
    setLaunching(true);
    setError("");
    try {
      const res = await window.api.playGame({
        gameId: game.id,
        gameTitle: game.title,
        token,
        installPath: game.install_path,
        executablePath: game.executable_path,
      });
      if (!res.success && res.error) setError(res.error);
    } finally {
      setLaunching(false);
    }
  }

  async function uninstallGame() {
    if (!game) return;
    const token = getToken();
    if (!token) {
      navigate("/");
      return;
    }
    if (!game.install_path) {
      setError("Chemin d'installation introuvable pour ce jeu.");
      return;
    }
    const ok = window.confirm(`Desinstaller ${game.title} ?`);
    if (!ok) return;

    setUninstalling(true);
    setError("");
    try {
      const res = await window.api.uninstallGame({ gameId: game.id, token, installPath: game.install_path });
      if (res.success) {
        setGame(prev => prev ? { ...prev, is_installed: false, install_path: null, installed_version: null } : prev);
      } else if (res.error) {
        setError(res.error);
      }
    } finally {
      setUninstalling(false);
    }
  }

  if (loading) {
    return (
      <div className="page library-game-page">
        <div className="library-game-breadcrumb-row">
          <div className="library-game-skeleton skeleton-line" style={{ width: 170, height: 30 }} />
          <div className="library-game-skeleton skeleton-line" style={{ width: 260, height: 16 }} />
        </div>

        <div className="card library-game-hero-card">
          <div className="library-game-skeleton library-game-skeleton-hero" />
          <div className="library-game-meta">
            <div className="library-game-skeleton skeleton-line" style={{ width: 160, height: 14 }} />
            <div className="library-game-skeleton skeleton-line" style={{ width: 140, height: 14 }} />
            <div className="library-game-skeleton skeleton-line" style={{ width: 220, height: 14 }} />
            <div className="library-game-skeleton skeleton-line" style={{ width: 180, height: 14 }} />
          </div>
        </div>

        <div className="card library-game-trophies-card">
          <div className="library-game-skeleton skeleton-line" style={{ width: 210, height: 18, marginBottom: 12 }} />
          <div className="library-game-skeleton skeleton-line" style={{ width: "100%", height: 8, marginBottom: 12 }} />
          <div className="library-game-type-grid">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="library-game-skeleton library-game-skeleton-card" />
            ))}
          </div>
          <div className="library-game-trophy-grid">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="library-game-skeleton library-game-skeleton-card" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const lastPlayedLabel = game ? fmtLastPlayed(game.last_played_at) : "Jamais";
  const installedVersionLabel = game?.installed_version ?? "Non installée";

  return (
    <div className="page library-game-page">
      <div className="library-game-breadcrumb-row">
        <button className="btn btn-ghost library-game-back" onClick={() => navigate("/library")}>
          <ArrowLeft size={14} /> Retour à la bibliothèque
        </button>
        <div className="library-game-breadcrumb">
          <span>Bibliothèque</span>
          <span className="sep">&gt;</span>
          <strong>{game?.title ?? "Jeu"}</strong>
        </div>
      </div>

      {error && <div className="banner banner-error">{error}</div>}

      {!game ? (
        <div className="card"><div className="empty"><div className="empty-icon">🎮</div><p>Jeu introuvable dans ta bibliothèque.</p></div></div>
      ) : (
        <>
          <div className="card library-game-hero-card">
            <div className="library-game-hero-banner">
              {game.banner_image ? (
                <img src={mediaUrl(game.id, "banner")} alt={game.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontSize: 42 }}>🎮</div>
              )}
              <div className="library-game-hero-overlay" />

              <div className="library-game-hero-content">
                <div className="library-game-cover-frame">
                  {game.cover_image ? (
                    <img src={mediaUrl(game.id, "cover")} alt={`${game.title} cover`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center" }}>🕹️</div>
                  )}
                </div>
                <div>
                  <div className="library-game-title">{game.title}</div>
                  <div className="library-game-badges">
                    {game.genre && <span className="badge badge-accent">{game.genre}</span>}
                    {game.version && <span className="badge badge-muted">v{game.version}</span>}
                    {game.is_installed ? <span className="badge badge-success">Installé</span> : <span className="badge badge-muted">Non installé</span>}
                  </div>
                </div>
                <div className="library-game-actions">
                  {game.is_installed ? (
                    <>
                      <button className="btn btn-primary" disabled={launching || uninstalling} onClick={() => void playGame()}>
                        <Play size={14} /> {launching ? "Lancement..." : "Jouer"}
                      </button>
                      <button className="btn btn-ghost" disabled={uninstalling || launching} onClick={() => void uninstallGame()}>
                        <Trash2 size={14} /> {uninstalling ? "Désinstallation..." : "Désinstaller"}
                      </button>
                    </>
                  ) : (
                    <button className="btn btn-primary" disabled={installing} onClick={() => void installGame()}>
                      <DownloadCloud size={14} /> {installing ? "Installation..." : "Installer"}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="library-game-meta">
              <div className="library-game-meta-item"><Clock3 size={13} /> Temps de jeu: {fmtPlaytime(game.playtime_minutes)}</div>
              <div className="library-game-meta-item"><DownloadCloud size={13} /> Taille: {game.install_size_mb ? `${game.install_size_mb} MB` : "-"}</div>
              <div className="library-game-meta-item">Dernier lancement: {lastPlayedLabel}</div>
              <div className="library-game-meta-item">Version installée: {installedVersionLabel}</div>
            </div>
          </div>

          <div className="card library-game-trophies-card">
            <div className="library-game-trophies-head">
              <div>
                <div className="library-game-trophies-title">Trophées</div>
                <div className="library-game-trophies-sub">Couleur = débloqué • Noir et blanc = non débloqué</div>
              </div>
              <span className="library-game-trophies-count">{unlockedCount}/{trophies.length} débloqués</span>
            </div>

            <div className="library-game-progress-wrap">
              <div className="library-game-progress-head">
                <span>Progression globale</span>
                <span>{overallPercent}%</span>
              </div>
              <div className="library-game-progress-track">
                <div style={{ width: `${overallPercent}%`, height: "100%", background: "linear-gradient(90deg, #22c55e, #10b981)", transition: "width .2s ease" }} />
              </div>
            </div>

            <div className="library-game-type-grid">
              {trophyStats.map((s) => (
                <div key={s.type} style={{ border: `1px solid ${TROPHY_COLORS[s.type]}55`, borderRadius: 10, padding: 8, background: `${TROPHY_COLORS[s.type]}14` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}>
                    <strong style={{ color: TROPHY_COLORS[s.type] }}>{TROPHY_LABELS[s.type]}</strong>
                    <span style={{ color: "var(--text-secondary)" }}>{s.unlocked}/{s.total}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, overflow: "hidden", border: "1px solid var(--border)", background: "var(--bg-surf)" }}>
                    <div style={{ width: `${s.percent}%`, height: "100%", background: TROPHY_COLORS[s.type], transition: "width .2s ease" }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="library-game-filter-row">
              <button className={`btn btn-sm ${trophyFilter === "all" ? "btn-primary" : "btn-ghost"}`} onClick={() => setTrophyFilter("all")}>Tous</button>
              <button className={`btn btn-sm ${trophyFilter === "unlocked" ? "btn-primary" : "btn-ghost"}`} onClick={() => setTrophyFilter("unlocked")}>Débloqués</button>
              <button className={`btn btn-sm ${trophyFilter === "locked" ? "btn-primary" : "btn-ghost"}`} onClick={() => setTrophyFilter("locked")}>Verrouillés</button>
            </div>

            {sortedTrophies.length === 0 ? (
              <div className="empty"><div className="empty-icon">🏆</div><p>Aucun trophée pour ce filtre.</p></div>
            ) : (
              <div className="library-game-trophy-grid">
                {sortedTrophies.map((trophy) => {
                  const type = normalizeTrophyType(trophy.trophy_type);
                  const isFreshUnlock = justUnlockedIds.includes(trophy.id);
                  return (
                    <div
                      key={trophy.id}
                      style={{
                        border: "1px solid var(--border)",
                        borderRadius: 10,
                        padding: 10,
                        background: trophy.unlocked
                          ? `linear-gradient(160deg, ${TROPHY_COLORS[type]}33, rgba(16,185,129,.03))`
                          : "linear-gradient(160deg, rgba(255,255,255,.03), rgba(255,255,255,.01))",
                        transform: isFreshUnlock ? "scale(1.03)" : "scale(1)",
                        boxShadow: isFreshUnlock ? "0 0 0 2px rgba(52,211,153,.45), 0 0 20px rgba(52,211,153,.35)" : "none",
                        transition: "transform .25s ease, box-shadow .25s ease",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <div style={{ fontSize: 28, filter: trophy.unlocked ? "none" : "grayscale(1) contrast(.3)", opacity: trophy.unlocked ? 1 : 0.65 }}>{trophy.icon}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700 }}>{trophy.title}</div>
                          <div style={{ fontSize: 11, color: TROPHY_COLORS[type], fontWeight: 700 }}>{TROPHY_LABELS[type]}</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: trophy.unlocked ? "var(--text-secondary)" : "#9ca3af" }}>{trophy.description}</div>
                      <div style={{ marginTop: 8, fontSize: 11, color: trophy.unlocked ? "#34d399" : "#9ca3af" }}>{trophy.unlocked ? "Débloqué" : "Verrouillé"}</div>
                      {trophy.unlocked && trophy.earned_at && (
                        <div style={{ marginTop: 4, fontSize: 10, color: "var(--text-secondary)" }}>Débloqué le {fmtUnlockedDate(trophy.earned_at)}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
