import { Outlet } from "react-router-dom";
import UpdateBanner from "./UpdateBanner";


export default function Layout() {
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
        <span>Header</span>
      </header>

      {/* Temporaire: banniere de mise a jour dans la zone du header */}
      <UpdateBanner />

      {/* Contenu de la page courante */}
      <main style={{ flex: 1, overflow: "auto" }}>
        <Outlet />
      </main>

      {/* Footer */}
      <footer style={{
        height: 32,
        background: "var(--bg-surface)",
        borderTop: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Footer</span>
      </footer>

    </div>
  );
}