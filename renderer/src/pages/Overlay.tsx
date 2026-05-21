import { useState, useEffect, useLayoutEffect } from "react";
import { Phone, PhoneOff, X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "../shared/i18n";

type OverlayCallData = {
  fromUserId: number;
  fromName: string;
  callType: "dm" | "group";
  groupId?: number;
};

type OverlayNotif = {
  id: string;
  type: "success" | "error" | "info" | "warning";
  title: string;
  message?: string;
  duration?: number;
};

type OverlayAPI = {
  onOverlayShowCall?:    (cb: (d: OverlayCallData) => void) => void;
  onOverlayHideCall?:    (cb: () => void) => void;
  onOverlayShowNotif?:   (cb: (d: OverlayNotif) => void) => void;
  onOverlayRemoveNotif?: (cb: (id: string) => void) => void;
  overlayAcceptCall?:    () => void;
  overlayDeclineCall?:   () => void;
  overlaySetInteractive?: (v: boolean) => void;
};

const notifColors = {
  success: "var(--color-success)",
  error:   "var(--color-danger)",
  info:    "var(--accent)",
  warning: "var(--color-warning)",
};

const notifIcons = {
  success: CheckCircle,
  error:   AlertCircle,
  info:    Info,
  warning: AlertTriangle,
};

export default function Overlay() {
  const { t } = useI18n();
  const [call, setCall]     = useState<OverlayCallData | null>(null);
  const [notifs, setNotifs] = useState<OverlayNotif[]>([]);

  // Transparent background — must run before paint
  useLayoutEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    document.body.style.overflow = "hidden";
  }, []);

  // Register IPC listeners once
  useEffect(() => {
    const api = (window as Window & { api?: OverlayAPI }).api;
    if (!api) return;

    api.onOverlayShowCall?.((d) => setCall(d));
    api.onOverlayHideCall?.(() => setCall(null));

    api.onOverlayShowNotif?.((d) => {
      setNotifs((prev) => [...prev, d]);
      const dur = d.duration ?? 4000;
      if (dur > 0) {
        setTimeout(() => setNotifs((prev) => prev.filter((n) => n.id !== d.id)), dur);
      }
    });

    api.onOverlayRemoveNotif?.((id) =>
      setNotifs((prev) => prev.filter((n) => n.id !== id))
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Toggle click-through based on visible content
  useEffect(() => {
    const api = (window as Window & { api?: OverlayAPI }).api;
    api?.overlaySetInteractive?.(call !== null || notifs.length > 0);
  }, [call, notifs.length]);

  const accept = () => {
    (window as Window & { api?: OverlayAPI }).api?.overlayAcceptCall?.();
    setCall(null);
  };

  const decline = () => {
    (window as Window & { api?: OverlayAPI }).api?.overlayDeclineCall?.();
    setCall(null);
  };

  const dismissNotif = (id: string) =>
    setNotifs((prev) => prev.filter((n) => n.id !== id));

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, pointerEvents: "none", background: "transparent" }}>

      {/* ── Incoming call card — top right ─────────────────────────────── */}
      <AnimatePresence>
        {call && (
          <motion.div
            key="overlay-call"
            initial={{ opacity: 0, x: 80, scale: 0.92 }}
            animate={{ opacity: 1, x: 0,  scale: 1    }}
            exit={{    opacity: 0, x: 80, scale: 0.92 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            style={{
              position: "absolute",
              top: 20,
              right: 20,
              background: "var(--bg-surface)",
              border: "1px solid var(--color-success)",
              borderRadius: 12,
              padding: "16px 20px",
              minWidth: 260,
              maxWidth: 320,
              boxShadow: "0 8px 40px rgba(0,0,0,0.75)",
              pointerEvents: "auto",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{
                width: 40, height: 40, borderRadius: "50%",
                background: "var(--color-success)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
                boxShadow: "0 0 0 6px rgba(62, 207, 142, 0.15)",
              }}>
                <Phone size={17} color="#fff" />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 3 }}>
                  {call.callType === "group" ? "Appel de groupe entrant" : "Appel entrant"}
                </div>
                <div style={{
                  fontSize: 14, fontWeight: 700,
                  color: "var(--text-primary)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {call.fromName}
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={accept}
                style={{
                  flex: 1, height: 34, borderRadius: 8, border: "none",
                  background: "var(--color-success)", color: "#fff",
                  fontWeight: 600, fontSize: 12, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  fontFamily: "inherit",
                }}
              >
                <Phone size={13} /> {t.friendsAccept}
              </button>
              <button
                onClick={decline}
                style={{
                  flex: 1, height: 34, borderRadius: 8, border: "none",
                  background: "var(--color-danger)", color: "#fff",
                  fontWeight: 600, fontSize: 12, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  fontFamily: "inherit",
                }}
              >
                <PhoneOff size={13} /> {t.friendsDecline}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Notification toasts — bottom right ─────────────────────────── */}
      <div style={{
        position: "absolute",
        bottom: 50,
        right: 20,
        display: "flex",
        flexDirection: "column-reverse",
        gap: 8,
        maxWidth: 340,
        pointerEvents: "none",
      }}>
        <AnimatePresence mode="popLayout">
          {notifs.map((n) => {
            const Icon  = notifIcons[n.type];
            const color = notifColors[n.type];
            return (
              <motion.div
                key={n.id}
                layout
                initial={{ opacity: 0, x: 80, scale: 0.92 }}
                animate={{ opacity: 1, x: 0,  scale: 1    }}
                exit={{    opacity: 0, x: 80, scale: 0.92 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                style={{
                  background: "var(--bg-surface)",
                  border: `1px solid ${color}`,
                  borderLeft: `3px solid ${color}`,
                  borderRadius: 8,
                  padding: "10px 12px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  pointerEvents: "auto",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
                }}
              >
                <Icon size={16} color={color} style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
                    {n.title}
                  </div>
                  {n.message && (
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                      {n.message}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => dismissNotif(n.id)}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    padding: 2, color: "var(--text-muted)", flexShrink: 0,
                    display: "flex", alignItems: "center",
                  }}
                >
                  <X size={12} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
