import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { Phone, PhoneOff, X, CheckCircle, AlertCircle, Info, AlertTriangle, MessageSquare, Send, UserPlus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "../shared/i18n";

type OverlayCallData = {
  fromUserId: number;
  fromName: string;
  callType: "dm" | "group";
  groupId?: number;
};

type OverlayMessage = {
  id: string;
  friendshipId: number;
  fromName: string;
  content: string;
  isGroup: boolean;
};

type OverlayAchievement = {
  id: string;
  icon: string;
  title: string;
  description: string;
};

type OverlayFriendRequest = {
  id: string;
  friendshipId: number;
  fromName: string;
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
  onOverlayShowMessage?: (cb: (d: OverlayMessage) => void) => void;
  overlayAcceptCall?:    () => void;
  overlayDeclineCall?:   () => void;
  overlayReplyMessage?:  (data: { friendshipId: number; content: string }) => void;
  overlaySetInteractive?: (v: boolean) => void;
  overlaySetFocusable?:   (v: boolean) => void;
  onOverlayShowAchievement?:  (cb: (d: OverlayAchievement) => void) => void;
  onOverlayShowFriendRequest?: (cb: (d: OverlayFriendRequest) => void) => void;
  overlayAcceptRequest?:      (data: { friendshipId: number }) => void;
  overlayDeclineRequest?:     (data: { friendshipId: number }) => void;
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
  const [call, setCall]         = useState<OverlayCallData | null>(null);
  const [notifs, setNotifs]     = useState<OverlayNotif[]>([]);
  const [messages, setMessages]         = useState<OverlayMessage[]>([]);
  const [achievements, setAchievements] = useState<OverlayAchievement[]>([]);
  const [friendReqs, setFriendReqs]     = useState<OverlayFriendRequest[]>([]);
  const replyTexts              = useRef<Record<string, string>>({});

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

    api.onOverlayShowMessage?.((d) => {
      setMessages((prev) => {
        // deduplicate by id
        if (prev.some((m) => m.id === d.id)) return prev;
        return [...prev, d];
      });
      // auto-dismiss after 30 s if not replied
      setTimeout(() =>
        setMessages((prev) => prev.filter((m) => m.id !== d.id)), 30_000
      );
    });

    api.onOverlayShowAchievement?.((d) => {
      setAchievements((prev) => {
        if (prev.some((a) => a.id === d.id)) return prev;
        return [...prev, d];
      });
      setTimeout(() =>
        setAchievements((prev) => prev.filter((a) => a.id !== d.id)), 8_000
      );
    });

    api.onOverlayShowFriendRequest?.((d) => {
      setFriendReqs((prev) => {
        if (prev.some((r) => r.id === d.id)) return prev;
        return [...prev, d];
      });
      setTimeout(() =>
        setFriendReqs((prev) => prev.filter((r) => r.id !== d.id)), 30_000
      );
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Toggle click-through based on visible content
  useEffect(() => {
    const api = (window as Window & { api?: OverlayAPI }).api;
    api?.overlaySetInteractive?.(
      call !== null || messages.length > 0 || friendReqs.length > 0
    );
  }, [call, notifs.length, messages.length, achievements.length, friendReqs.length]);

  // Allow keyboard input in reply field when message cards are visible
  useEffect(() => {
    const api = (window as Window & { api?: OverlayAPI }).api;
    api?.overlaySetFocusable?.(messages.length > 0 || friendReqs.length > 0);
  }, [messages.length, friendReqs.length]);

  const dismissAchievement = (id: string) =>
    setAchievements((prev) => prev.filter((a) => a.id !== id));

  const acceptFriendReq = (id: string, friendshipId: number) => {
    (window as Window & { api?: OverlayAPI }).api?.overlayAcceptRequest?.({ friendshipId });
    setFriendReqs((prev) => prev.filter((r) => r.id !== id));
  };

  const declineFriendReq = (id: string, friendshipId: number) => {
    (window as Window & { api?: OverlayAPI }).api?.overlayDeclineRequest?.({ friendshipId });
    setFriendReqs((prev) => prev.filter((r) => r.id !== id));
  };

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

  const dismissMessage = (id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
    delete replyTexts.current[id];
  };

  const sendReply = (id: string, friendshipId: number) => {
    const content = (replyTexts.current[id] ?? "").trim();
    if (!content) return;
    (window as Window & { api?: OverlayAPI }).api?.overlayReplyMessage?.({ friendshipId, content });
    dismissMessage(id);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, pointerEvents: "none", background: "transparent" }}>

      {/* ── Incoming call + message cards — top right ──────────────────── */}
      <div style={{
        position: "absolute",
        top: 20,
        right: 20,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        maxWidth: 320,
        pointerEvents: "none",
      }}>

        {/* Incoming call card */}
        <AnimatePresence>
          {call && (
            <motion.div
              key="overlay-call"
              initial={{ opacity: 0, x: 80, scale: 0.92 }}
              animate={{ opacity: 1, x: 0,  scale: 1    }}
              exit={{    opacity: 0, x: 80, scale: 0.92 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--color-success)",
                borderRadius: 12,
                padding: "16px 20px",
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

        {/* Message cards with quick reply */}
        <AnimatePresence mode="popLayout">
          {messages.map((m) => (
            <motion.div
              key={m.id}
              layout
              initial={{ opacity: 0, x: 80, scale: 0.92 }}
              animate={{ opacity: 1, x: 0,  scale: 1    }}
              exit={{    opacity: 0, x: 80, scale: 0.92 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--accent)",
                borderRadius: 12,
                padding: "12px 14px",
                boxShadow: "0 8px 40px rgba(0,0,0,0.75)",
                pointerEvents: "auto",
              }}
            >
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: "var(--accent)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <MessageSquare size={14} color="#fff" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 1 }}>
                    {m.isGroup ? "Message de groupe" : "Message"}
                  </div>
                  <div style={{
                    fontSize: 13, fontWeight: 700,
                    color: "var(--text-primary)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {m.fromName}
                  </div>
                </div>
                <button
                  onClick={() => dismissMessage(m.id)}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    padding: 2, color: "var(--text-muted)", flexShrink: 0,
                    display: "flex", alignItems: "center",
                  }}
                >
                  <X size={12} />
                </button>
              </div>

              {/* Message preview */}
              {m.content && (
                <div style={{
                  fontSize: 12, color: "var(--text-muted)",
                  marginBottom: 10,
                  overflow: "hidden",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  lineHeight: 1.4,
                }}>
                  {m.content}
                </div>
              )}

              {/* Reply input */}
              {!m.isGroup && (
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    type="text"
                    placeholder={t.overlayMsgReply}
                    defaultValue=""
                    onChange={(e) => {
                      replyTexts.current[m.id] = e.target.value;
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        sendReply(m.id, m.friendshipId);
                      }
                    }}
                    style={{
                      flex: 1,
                      height: 30,
                      borderRadius: 6,
                      border: "1px solid var(--border-color)",
                      background: "var(--bg-input)",
                      color: "var(--text-primary)",
                      padding: "0 8px",
                      fontSize: 12,
                      fontFamily: "inherit",
                      outline: "none",
                    }}
                  />
                  <button
                    onClick={() => sendReply(m.id, m.friendshipId)}
                    title={t.overlaySend}
                    style={{
                      width: 30, height: 30, borderRadius: 6, border: "none",
                      background: "var(--accent)", color: "#fff",
                      cursor: "pointer", display: "flex",
                      alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}
                  >
                    <Send size={13} />
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

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

      {/* ── Friend-request cards — top right column (with call/msg) ─────── */}
      <AnimatePresence mode="popLayout">
        {friendReqs.map((r) => (
          <motion.div
            key={r.id}
            layout
            initial={{ opacity: 0, x: 80, scale: 0.92 }}
            animate={{ opacity: 1, x: 0,  scale: 1    }}
            exit={{    opacity: 0, x: 80, scale: 0.92 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            style={{
              position: "absolute",
              top: 20,
              right: 20,
              background: "var(--bg-surface)",
              border: "1px solid var(--accent)",
              borderRadius: 12,
              padding: "12px 14px",
              minWidth: 260,
              maxWidth: 320,
              boxShadow: "0 8px 40px rgba(0,0,0,0.75)",
              pointerEvents: "auto",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                background: "var(--accent-dim)",
                border: "1.5px solid var(--accent)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <UserPlus size={16} color="var(--accent)" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 1 }}>
                  {t.overlayFriendRequest}
                </div>
                <div style={{
                  fontSize: 13, fontWeight: 700,
                  color: "var(--text-primary)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {r.fromName}
                </div>
              </div>
              <button
                onClick={() => setFriendReqs((p) => p.filter((x) => x.id !== r.id))}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "var(--text-muted)", display: "flex" }}
              >
                <X size={12} />
              </button>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => acceptFriendReq(r.id, r.friendshipId)}
                style={{
                  flex: 1, height: 30, borderRadius: 7, border: "none",
                  background: "var(--accent)", color: "#fff",
                  fontWeight: 600, fontSize: 11, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                  fontFamily: "inherit",
                }}
              >
                {t.friendsAccept}
              </button>
              <button
                onClick={() => declineFriendReq(r.id, r.friendshipId)}
                style={{
                  flex: 1, height: 30, borderRadius: 7,
                  border: "1px solid var(--color-danger)",
                  background: "var(--bg-overlay)", color: "var(--color-danger)",
                  fontWeight: 600, fontSize: 11, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                  fontFamily: "inherit",
                }}
              >
                {t.friendsDecline}
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* ── Achievement notifications — bottom center, dramatic ──────────── */}
      <div style={{
        position: "absolute",
        bottom: 60,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        pointerEvents: "none",
      }}>
        <AnimatePresence mode="popLayout">
          {achievements.map((a) => (
            <motion.div
              key={a.id}
              layout
              initial={{ opacity: 0, y: 60, scale: 0.8 }}
              animate={{ opacity: 1, y: 0,  scale: 1   }}
              exit={{    opacity: 0, y: 40, scale: 0.9  }}
              transition={{ type: "spring", stiffness: 320, damping: 22 }}
              style={{
                background: "linear-gradient(135deg, #1a1506 0%, var(--bg-surface) 60%)",
                border: "1.5px solid #FFD700",
                borderRadius: 16,
                padding: "18px 24px",
                minWidth: 280,
                maxWidth: 380,
                boxShadow: "0 0 40px rgba(255,215,0,0.25), 0 8px 40px rgba(0,0,0,0.8)",
                pointerEvents: "auto",
                display: "flex",
                alignItems: "center",
                gap: 16,
              }}
            >
              {/* Animated icon */}
              <motion.span
                style={{ fontSize: 40, lineHeight: 1, flexShrink: 0, display: "inline-block" }}
                animate={{
                  scale:  [1, 1.25, 1, 1.15, 1],
                  rotate: [0, -8, 8, -4, 0],
                  filter: [
                    "drop-shadow(0 0 4px #FFD700)",
                    "drop-shadow(0 0 22px #FFD700)",
                    "drop-shadow(0 0 4px #FFD700)",
                    "drop-shadow(0 0 16px #FFD700)",
                    "drop-shadow(0 0 4px #FFD700)",
                  ],
                }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              >
                {a.icon}
              </motion.span>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                  textTransform: "uppercase", color: "#FFD700", marginBottom: 3,
                }}>
                  {t.achievementUnlocked}
                </div>
                <div style={{
                  fontSize: 15, fontWeight: 700,
                  color: "var(--text-primary)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {a.title}
                </div>
                {a.description && (
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                    {a.description}
                  </div>
                )}
              </div>

              <button
                onClick={() => dismissAchievement(a.id)}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  padding: 4, color: "var(--text-muted)", flexShrink: 0,
                  display: "flex", alignItems: "center",
                }}
              >
                <X size={13} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
