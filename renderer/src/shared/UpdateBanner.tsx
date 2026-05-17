import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X } from "lucide-react";
import { useI18n } from "./i18n";

interface UpdateInfo {
  available: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseNotes: string | null;
  error: string | null;
}

function isNoPublishedReleaseError(error: string): boolean {
  const lowered = error.toLowerCase();
  return (
    lowered.includes("unable to find latest version on github") ||
    lowered.includes("releases/latest") ||
    lowered.includes("no published versions")
  );
}

export default function UpdateBanner() {
  const { t } = useI18n();
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // ── isUpdateAvailable au montage ──────────────────────────────────────────
  useEffect(() => {
    window.api.isUpdateAvailable().then((result) => {
      if (result.available) {
        setInfo(result);
        return;
      }

      if (result.error) {
        if (isNoPublishedReleaseError(result.error)) {
          return;
        }

        console.warn("Update check failed:", result.error);
        setError(result.error);
      }
    });

    window.api.onUpdateProgress((percent) => setProgress(percent));
  }, []);

  // ── installUpdate ─────────────────────────────────────────────────────────
  const handleInstall = () => {
    setProgress(0);
    window.api.installUpdate();
  };

  if (dismissed || (!info && !error)) return null;

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
          background: info ? "var(--accent-dim)" : "rgba(255, 184, 0, 0.12)",
          borderBottom: info ? "1px solid rgba(0,180,216,0.3)" : "1px solid rgba(255, 184, 0, 0.35)",
          fontSize: 13,
          gap: 12,
        }}
      >
        <span style={{ color: info ? "var(--accent)" : "#ffb800" }}>
          {info
            ? (progress !== null
              ? `${t.updateDownloading} ${progress}%`
              : `v${info.latestVersion} ${t.updateIsAvailable} (${t.updateCurrentVersionLabel}: v${info.currentVersion})`)
            : `${t.updateCheckFailed}: ${error}`}
        </span>

        {info && progress !== null && (
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
          {info && progress === null && (
            <button
              className="btn btn-primary"
              style={{ padding: "4px 12px", fontSize: 12 }}
              onClick={handleInstall}
            >
              <Download size={13} /> {t.updateNow}
            </button>
          )}
          <button
            className="btn btn-ghost"
            style={{ padding: "4px 8px" }}
            onClick={() => setDismissed(true)}
          >
            <X size={13} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}