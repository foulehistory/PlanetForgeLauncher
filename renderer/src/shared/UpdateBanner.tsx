import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X }            from "lucide-react";

interface UpdateInfo {
  available:      boolean;
  currentVersion: string;
  latestVersion:  string;
  releaseNotes:   string | null;
}

export default function UpdateBanner() {
  const [info, setInfo]           = useState<UpdateInfo | null>(null);
  const [progress, setProgress]   = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // ── isUpdateAvailable au montage ──────────────────────────────────────────
  useEffect(() => {
    window.api.isUpdateAvailable().then((result) => {
      if (result.available) setInfo(result);
    });

    window.api.onUpdateProgress((percent) => setProgress(percent));
  }, []);

  // ── installUpdate ─────────────────────────────────────────────────────────
  const handleInstall = () => {
    setProgress(0);
    window.api.installUpdate();
  };

  if (dismissed || !info) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -40 }}
        transition={{ duration: 0.2 }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 16px",
          background: "var(--accent-dim)",
          borderBottom: "1px solid rgba(0,180,216,0.3)",
          fontSize: 13,
          gap: 12,
        }}
      >
        <span style={{ color: "var(--accent)" }}>
          {progress !== null
            ? `Downloading… ${progress}%`
            : `v${info.latestVersion} is available (current: v${info.currentVersion})`
          }
        </span>

        {/* Barre de progression */}
        {progress !== null && (
          <div style={{
            flex: 1, maxWidth: 200,
            height: 4, borderRadius: 2,
            background: "var(--bg-overlay)",
          }}>
            <motion.div
              animate={{ width: `${progress}%` }}
              style={{ height: "100%", borderRadius: 2, background: "var(--accent)" }}
            />
          </div>
        )}

        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {progress === null && (
            <button
              className="btn btn-primary"
              style={{ padding: "4px 12px", fontSize: 12 }}
              onClick={handleInstall}
            >
              <Download size={13} /> Update now
            </button>
          )}
          {progress === null && (
            <button
              className="btn btn-ghost"
              style={{ padding: "4px 8px" }}
              onClick={() => setDismissed(true)}
            >
              <X size={13} />
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}