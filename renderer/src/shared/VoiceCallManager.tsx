/**
 * VoiceCallManager
 *
 * Manages WebRTC voice calls (DM or group).
 * Handles signaling via the shared WS connection dispatched through
 * the "ws:message" CustomEvent emitted by Layout.tsx.
 *
 * Usage:
 *   <VoiceCallManager wsRef={wsRef} myId={myId} />
 *
 * To initiate a call from anywhere in the app, dispatch:
 *   window.dispatchEvent(new CustomEvent("voice:call", {
 *     detail: { toUserId: 123, toName: "Alice" }                 // DM call
 *   }));
 *   window.dispatchEvent(new CustomEvent("voice:call", {
 *     detail: { groupId: 5, groupName: "Crew", memberIds: [1,2,3] }   // group call
 *   }));
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, PhoneOff, Phone, Headphones, HeadphoneOff } from "lucide-react";

const STUN = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
const API  = (window as Window & { __API_BASE__?: string }).__API_BASE__
           ?? (import.meta as { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE
           ?? "http://localhost:8000";

function getToken(): string | null {
  const rememberMe = localStorage.getItem("remember-me") === "true";
  return (rememberMe ? localStorage : sessionStorage).getItem("auth-token");
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface CallTarget {
  type: "dm" | "group";
  // DM
  toUserId?: number;
  toName?: string;
  // Group
  groupId?: number;
  groupName?: string;
  memberIds?: number[];
}

interface IncomingCall {
  fromUserId: number;
  fromName: string;
  callType: "dm" | "group";
  groupId?: number;
  sdp: RTCSessionDescriptionInit;
}

interface PeerState {
  pc: RTCPeerConnection;
  userId: number;
  name: string;
  audioEl: HTMLAudioElement;
  muted: boolean;
}

interface Props {
  wsRef: React.MutableRefObject<WebSocket | null>;
  myId: number | null;
}

export default function VoiceCallManager({ wsRef, myId }: Props) {
  const [incomingCall, setIncomingCall]   = useState<IncomingCall | null>(null);
  const [activeTarget, setActiveTarget]   = useState<CallTarget | null>(null);
  const [callStatus,   setCallStatus]     = useState<"calling" | "connected" | "idle">("idle");
  const [muted,        setMuted]          = useState(false);
  const [deafened,     setDeafened]       = useState(false);
  const [duration,     setDuration]       = useState(0);

  const peers        = useRef<Map<number, PeerState>>(new Map());
  const localStream   = useRef<MediaStream | null>(null);
  const durationTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringtoneEl    = useRef<HTMLAudioElement | null>(null);
  const dmTimeoutRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aloneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // activeTargetRef: stale-closure-safe copy of activeTarget for callbacks
  const activeTargetRef = useRef<CallTarget | null>(null);
  useEffect(() => { activeTargetRef.current = activeTarget; }, [activeTarget]);

  // ─── Ringtone helpers ───────────────────────────────────────────────────────
  const playRingtone = useCallback(() => {
    if (ringtoneEl.current) return; // already playing
    const el = new Audio("/sonnerie.mp3");
    el.loop = true;
    el.volume = 0.6;
    el.play().catch(() => { /* autoplay blocked, ignore */ });
    ringtoneEl.current = el;
  }, []);

  const stopRingtone = useCallback(() => {
    if (!ringtoneEl.current) return;
    ringtoneEl.current.pause();
    ringtoneEl.current.src = "";
    ringtoneEl.current = null;
  }, []);

  // ─── WS send helper ──────────────────────────────────────────────────────
  const wsSend = useCallback((payload: object) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }, [wsRef]);

  // ─── Get local audio stream ───────────────────────────────────────────────
  const getLocalStream = useCallback(async (): Promise<MediaStream | null> => {
    if (localStream.current) return localStream.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStream.current = stream;
      return stream;
    } catch {
      return null;
    }
  }, []);

  // ─── Create a RTCPeerConnection for one peer ──────────────────────────────
  const createPeer = useCallback(async (
    userId: number,
    name: string,
    localAudio: MediaStream,
    isInitiator: boolean,
  ): Promise<RTCPeerConnection> => {
    const pc = new RTCPeerConnection(STUN);
    const audioEl = new Audio();
    audioEl.autoplay = true;

    // Add local tracks
    localAudio.getTracks().forEach((t) => pc.addTrack(t, localAudio));

    // Play remote audio
    pc.ontrack = (ev) => {
      audioEl.srcObject = ev.streams[0];
    };

    // Send ICE candidates
    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        wsSend({ type: "rtc_ice", to_user_id: userId, candidate: ev.candidate.toJSON() });
      }
    };

    peers.current.set(userId, { pc, userId, name, audioEl, muted: false });

    if (isInitiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
    }

    return pc;
  }, [wsSend]);

  // ─── Tear down all peers ──────────────────────────────────────────────────
  const hangUpAll = useCallback((notify = true) => {
    if (notify && activeTarget) {
      if (activeTarget.type === "dm" && activeTarget.toUserId) {
        wsSend({ type: "rtc_hang_up", to_user_id: activeTarget.toUserId });
      } else if (activeTarget.type === "group" && activeTarget.groupId) {
        wsSend({ type: "rtc_group_hang_up", group_id: activeTarget.groupId });
      }
    }

    peers.current.forEach(({ pc, audioEl }) => {
      pc.close();
      audioEl.srcObject = null;
    });
    peers.current.clear();

    if (localStream.current) {
      localStream.current.getTracks().forEach((t) => t.stop());
      localStream.current = null;
    }

    if (durationTimer.current) {
      clearInterval(durationTimer.current);
      durationTimer.current = null;
    }

    setCallStatus("idle");
    setActiveTarget(null);
    setDuration(0);
    setMuted(false);
    setDeafened(false);
    stopRingtone();
    if (dmTimeoutRef.current)  { clearTimeout(dmTimeoutRef.current);  dmTimeoutRef.current  = null; }
    if (aloneTimerRef.current) { clearTimeout(aloneTimerRef.current); aloneTimerRef.current = null; }
  }, [activeTarget, wsSend, stopRingtone]);

  // ─── Initiate a call ─────────────────────────────────────────────────────
  const startCall = useCallback(async (target: CallTarget) => {
    const stream = await getLocalStream();
    if (!stream) return;
    setActiveTarget(target);
    setCallStatus("calling");
    playRingtone();

    if (target.type === "dm" && target.toUserId) {
      // Auto-hang-up after 60 s with no answer
      dmTimeoutRef.current = setTimeout(() => hangUpAll(true), 60_000);

      const pc = await createPeer(target.toUserId, target.toName ?? "?", stream, true);
      const offer = pc.localDescription;
      if (offer) {
        wsSend({ type: "rtc_offer", to_user_id: target.toUserId, sdp: offer, call_type: "dm" });
      }
    } else if (target.type === "group" && target.memberIds) {
      // Auto-hang-up after 2 min if still alone (no one joined)
      aloneTimerRef.current = setTimeout(async () => {
        const t = activeTargetRef.current;
        if (peers.current.size === 0 && t?.type === "group" && t.groupId) {
          await fetch(`${API}/api/groups/${t.groupId}/messages`, {
            method: "POST",
            headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
            body: JSON.stringify({ content: "📞 Appel vocal manqué — personne n'a répondu.", gif_url: null }),
          });
        }
        hangUpAll(false);
      }, 120_000);

      for (const uid of target.memberIds) {
        if (uid === myId) continue;
        const pc = await createPeer(uid, `#${uid}`, stream, true);
        const offer = pc.localDescription;
        if (offer) {
          wsSend({ type: "rtc_offer", to_user_id: uid, sdp: offer, call_type: "group", group_id: target.groupId });
        }
      }
    }
  }, [getLocalStream, createPeer, wsSend, myId, playRingtone, hangUpAll]);

  // ─── Accept incoming call ─────────────────────────────────────────────────
  const acceptCall = useCallback(async () => {
    if (!incomingCall) return;
    const stream = await getLocalStream();
    if (!stream) return;

    setActiveTarget({
      type: incomingCall.callType,
      toUserId: incomingCall.callType === "dm" ? incomingCall.fromUserId : undefined,
      toName:   incomingCall.fromName,
      groupId:  incomingCall.groupId,
    });
    setCallStatus("connected");
    setIncomingCall(null);
    stopRingtone();
    if (dmTimeoutRef.current)  { clearTimeout(dmTimeoutRef.current);  dmTimeoutRef.current  = null; }

    const pc = await createPeer(incomingCall.fromUserId, incomingCall.fromName, stream, false);
    await pc.setRemoteDescription(incomingCall.sdp);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    wsSend({ type: "rtc_answer", to_user_id: incomingCall.fromUserId, sdp: answer });

    durationTimer.current = setInterval(() => setDuration((d) => d + 1), 1000);
  }, [incomingCall, getLocalStream, createPeer, wsSend]);

  // ─── Decline incoming call ────────────────────────────────────────────────
  const declineCall = useCallback(() => {
    if (incomingCall) {
      wsSend({ type: "rtc_hang_up", to_user_id: incomingCall.fromUserId });
    }
    stopRingtone();
    setIncomingCall(null);
  }, [incomingCall, wsSend, stopRingtone]);

  // Play ringtone for the callee when an incoming call arrives
  useEffect(() => {
    if (incomingCall) playRingtone();
    else stopRingtone();
  }, [incomingCall, playRingtone, stopRingtone]);

  // ─── Toggle mute (mic) ───────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    if (!localStream.current) return;
    const track = localStream.current.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMuted(!track.enabled);
    }
  }, []);

  // ─── Toggle deafen (remote audio) ────────────────────────────────────────
  const toggleDeafen = useCallback(() => {
    const next = !deafened;
    peers.current.forEach(({ audioEl }) => {
      audioEl.muted = next;
    });
    setDeafened(next);
    // Also mute mic when deafening (common convention)
    if (next && localStream.current) {
      const track = localStream.current.getAudioTracks()[0];
      if (track) { track.enabled = false; setMuted(true); }
    } else if (!next && localStream.current) {
      const track = localStream.current.getAudioTracks()[0];
      if (track) { track.enabled = true; setMuted(false); }
    }
  }, [deafened]);

  // ─── Listen to WS RTC events ─────────────────────────────────────────────
  useEffect(() => {
    const handler = async (e: Event) => {
      const msg = (e as CustomEvent).detail as Record<string, unknown>;
      const type = msg.type as string;

      if (type === "rtc_offer") {
        // Show incoming call notification
        const fromId   = msg.from_user_id as number;
        const fromName = (msg.from_name as string | null) ?? `Utilisateur #${fromId}`;
        const sdp      = msg.sdp as RTCSessionDescriptionInit;
        setIncomingCall({
          fromUserId: fromId,
          fromName,
          callType:   (msg.call_type as "dm" | "group") ?? "dm",
          groupId:    msg.group_id as number | undefined,
          sdp,
        });
      } else if (type === "rtc_answer") {
        const fromId = msg.from_user_id as number;
        const peer   = peers.current.get(fromId);
        if (peer) {
          await peer.pc.setRemoteDescription(msg.sdp as RTCSessionDescriptionInit);
          setCallStatus("connected");
          stopRingtone();
          if (dmTimeoutRef.current)  { clearTimeout(dmTimeoutRef.current);  dmTimeoutRef.current  = null; }
          if (aloneTimerRef.current) { clearTimeout(aloneTimerRef.current); aloneTimerRef.current = null; }
          durationTimer.current = setInterval(() => setDuration((d) => d + 1), 1000);
        }
      } else if (type === "rtc_ice") {
        const fromId = msg.from_user_id as number;
        const peer   = peers.current.get(fromId);
        if (peer && msg.candidate) {
          try {
            await peer.pc.addIceCandidate(new RTCIceCandidate(msg.candidate as RTCIceCandidateInit));
          } catch { /* ignore late candidates */ }
        }
      } else if (type === "rtc_hang_up" || type === "rtc_group_hang_up") {
        // Dismiss incoming call modal if the caller cancelled before we answered
        stopRingtone();
        setIncomingCall(null);
        hangUpAll(false);
      }
    };

    window.addEventListener("ws:message", handler);
    return () => window.removeEventListener("ws:message", handler);
  }, [hangUpAll]);

  // ─── Listen to voice:call events from FriendsPanel ───────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as CallTarget;
      startCall(detail);
    };
    window.addEventListener("voice:call", handler);
    return () => window.removeEventListener("voice:call", handler);
  }, [startCall]);

  // ─── Format duration ─────────────────────────────────────────────────────
  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // ─── Render ───────────────────────────────────────────────────────────────
  const callName = activeTarget?.type === "group"
    ? activeTarget.groupName ?? "Groupe"
    : activeTarget?.toName ?? "…";

  return (
    <AnimatePresence>
      {/* ── Incoming call modal ─────────────────────────────────────── */}
      {incomingCall && (
        <motion.div
          key="incoming"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
          style={{
            position: "fixed", top: 70, right: 18, zIndex: 9000,
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "14px 18px",
            minWidth: 230,
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          }}
        >
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Appel entrant
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>
            📞 {incomingCall.fromName}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn"
              style={{ flex: 1, height: 32, fontSize: 12, background: "var(--color-success)", color: "#fff", border: "none", gap: 6 }}
              onClick={acceptCall}
            >
              <Phone size={13} /> Accepter
            </button>
            <button
              className="btn"
              style={{ flex: 1, height: 32, fontSize: 12, background: "var(--color-danger)", color: "#fff", border: "none", gap: 6 }}
              onClick={declineCall}
            >
              <PhoneOff size={13} /> Refuser
            </button>
          </div>
        </motion.div>
      )}

      {/* ── Active call HUD ─────────────────────────────────────────── */}
      {callStatus !== "idle" && activeTarget && !incomingCall && (
        <motion.div
          key="active"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
          style={{
            position: "fixed", top: 70, right: 18, zIndex: 9000,
            background: "var(--bg-surface)",
            border: `1px solid ${callStatus === "connected" ? "var(--color-success)" : "var(--border)"}`,
            borderRadius: 10,
            padding: "12px 16px",
            minWidth: 210,
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          }}
        >
          {/* Status indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: callStatus === "connected" ? "var(--color-success)" : "var(--color-warning)",
              flexShrink: 0,
            }} />
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {callStatus === "connected" ? fmt(duration) : "Appel en cours…"}
            </span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {callName}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn btn-ghost btn-icon"
              title={deafened ? "Désactiver la sourdine" : "Sourdine (tout couper)"}
              onClick={toggleDeafen}
              style={{ height: 32, width: 32, color: deafened ? "var(--color-danger)" : "var(--text-secondary)" }}
            >
              {deafened ? <HeadphoneOff size={14} /> : <Headphones size={14} />}
            </button>
            <button
              className="btn btn-ghost btn-icon"
              title={muted ? "Activer le micro" : "Couper le micro"}
              onClick={toggleMute}
              style={{ height: 32, width: 32, color: muted ? "var(--color-warning)" : "var(--text-secondary)", opacity: deafened ? 0.4 : 1 }}
            >
              {muted ? <MicOff size={14} /> : <Mic size={14} />}
            </button>
            <button
              className="btn"
              style={{ flex: 1, height: 32, fontSize: 12, background: "var(--color-danger)", color: "#fff", border: "none", gap: 6 }}
              onClick={() => hangUpAll(true)}
            >
              <PhoneOff size={13} /> Raccrocher
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
