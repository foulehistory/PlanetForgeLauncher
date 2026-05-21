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
import { Mic, MicOff, PhoneOff, Phone, Headphones, HeadphoneOff, Monitor, MonitorOff, X, Volume2 } from "lucide-react";
import { useI18n } from "./i18n";

// ICE servers: Google STUN + free OpenRelay TURN (fallback when STUN alone can't pierce NAT)
const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
    {
      urls: [
        "turn:openrelay.metered.ca:80",
        "turn:openrelay.metered.ca:443",
        "turns:openrelay.metered.ca:443?transport=tcp",
      ],
      username:   "openrelayproject",
      credential: "openrelayproject",
    },
  ],
  iceCandidatePoolSize: 10,
};
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

interface ScreenSource {
  id: string;
  name: string;
  thumbnail: string;  // data URL
  appIcon: string | null;
}

type ScreenElectronAPI = {
  getScreenSources?: () => Promise<ScreenSource[]>;
};

export default function VoiceCallManager({ wsRef, myId }: Props) {
  const { t } = useI18n();
  const [incomingCall, setIncomingCall]   = useState<IncomingCall | null>(null);
  const [activeTarget, setActiveTarget]   = useState<CallTarget | null>(null);
  const [callStatus,   setCallStatus]     = useState<"calling" | "connected" | "idle">("idle");
  const [muted,        setMuted]          = useState(false);
  const [deafened,     setDeafened]       = useState(false);
  const [duration,     setDuration]       = useState(0);
  const [isScreenSharing,    setIsScreenSharing]    = useState(false);
  const [screenPickerOpen,   setScreenPickerOpen]   = useState(false);
  const [screenSources,      setScreenSources]      = useState<ScreenSource[]>([]);
  const [remoteScreenStream, setRemoteScreenStream] = useState<MediaStream | null>(null);
  const [remoteScreenFrom,   setRemoteScreenFrom]   = useState<string | null>(null);
  const [screenMinimized,    setScreenMinimized]    = useState(false);
  const [remoteScreenHidden, setRemoteScreenHidden] = useState(false);
  const [shareWithAudio,     setShareWithAudio]     = useState(false);
  const [screenPickerTab,    setScreenPickerTab]     = useState<"screen" | "app">("screen");
  const [participantVolumes, setParticipantVolumes]  = useState<Record<number, number>>({});
  const [remoteVideoVolume,  setRemoteVideoVolume]   = useState(1);
  const [peerList,           setPeerList]            = useState<Array<{ userId: number; name: string }>>([]);

  const peers          = useRef<Map<number, PeerState>>(new Map());
  const localStream     = useRef<MediaStream | null>(null);
  const durationTimer   = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringtoneEl      = useRef<HTMLAudioElement | null>(null);
  const dmTimeoutRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aloneTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Buffer ICE candidates that arrive before the peer connection is created (callee side)
  const iceBuffer       = useRef<Map<number, RTCIceCandidateInit[]>>(new Map());
  // activeTargetRef: stale-closure-safe copy of activeTarget for callbacks
  const activeTargetRef = useRef<CallTarget | null>(null);
  // Screen sharing refs
  const screenStream    = useRef<MediaStream | null>(null);
  const screenSenders   = useRef<Map<number, RTCRtpSender[]>>(new Map());
  const remoteVideoRef  = useRef<HTMLVideoElement | null>(null);
  useEffect(() => { activeTargetRef.current = activeTarget; }, [activeTarget]);
  // Attach remote screen stream to the <video> element whenever it changes
  // or when the overlay is re-shown after being hidden.
  useEffect(() => {
    const el = remoteVideoRef.current;
    if (!el) return;
    el.srcObject = remoteScreenStream;
    if (remoteScreenStream) {
      el.volume = remoteVideoVolume;
      el.play().catch(() => {});
    }
  }, [remoteScreenStream, remoteScreenHidden]); // eslint-disable-line react-hooks/exhaustive-deps
  // Sync audio volume of the remote screen share video
  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.volume = remoteVideoVolume;
  }, [remoteVideoVolume]);

  // ─── Ringtone helpers ───────────────────────────────────────────────────────
  const playRingtone = useCallback(() => {
    if (ringtoneEl.current) return; // already playing
    // Use a URL relative to the current page so it works in both dev (http://)
    // and the packaged Electron app (file://). An absolute path like "/sonnerie.mp3"
    // resolves to the filesystem root under file:// and breaks in the packaged build.
    const ringtoneUrl = new URL("sonnerie.mp3", window.location.href).href;
    const el = new Audio(ringtoneUrl);
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
    const pc = new RTCPeerConnection(ICE_CONFIG);
    const audioEl = new Audio();
    audioEl.autoplay = true;
    audioEl.style.display = "none";
    document.body.appendChild(audioEl); // must be in DOM for Electron autoplay

    // Add local tracks
    localAudio.getTracks().forEach((t) => pc.addTrack(t, localAudio));

    // Play remote audio / reveal remote screen share when tracks arrive
    // peerScreenShareStreamId tracks which stream contains the screen share video+audio
    // so we don't accidentally route screen audio into the voice audioEl.
    let peerScreenShareStreamId: string | null = null;
    pc.ontrack = (ev) => {
      if (ev.track.kind === "audio") {
        // Skip: screen share audio lives in the same stream as the video track;
        // the <video> element will play it automatically.
        if (peerScreenShareStreamId && ev.streams[0]?.id === peerScreenShareStreamId) return;
        audioEl.srcObject = ev.streams[0];
        audioEl.play().catch(() => { /* autoplay policy — rare in Electron */ });
      } else if (ev.track.kind === "video") {
        // Fallback: some WebRTC impls fire ontrack with an empty ev.streams array
        const stream = ev.streams[0] ?? new MediaStream([ev.track]);
        peerScreenShareStreamId = stream.id;
        setRemoteScreenStream(stream);
        setRemoteScreenFrom(name);
        setScreenMinimized(false);
        setRemoteScreenHidden(false);
      }
    };

    // Send ICE candidates via WS signaling
    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        wsSend({ type: "rtc_ice", to_user_id: userId, candidate: ev.candidate.toJSON() });
      }
    };

    peers.current.set(userId, { pc, userId, name, audioEl, muted: false });
    setPeerList((prev) => [...prev.filter((p) => p.userId !== userId), { userId, name }]);

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
      audioEl.remove(); // detach from DOM
    });
    peers.current.clear();
    iceBuffer.current.clear();

    // Clean up any active screen share
    if (screenStream.current) {
      screenStream.current.getTracks().forEach((t) => t.stop());
      screenStream.current = null;
    }
    screenSenders.current.clear();
    setIsScreenSharing(false);
    setRemoteScreenStream(null);
    setRemoteScreenFrom(null);
    setRemoteScreenHidden(false);

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
    setPeerList([]);
    setParticipantVolumes({});
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
    (window as Window & { api?: { overlayHideCall?: () => void } }).api?.overlayHideCall?.();
    stopRingtone();
    if (dmTimeoutRef.current)  { clearTimeout(dmTimeoutRef.current);  dmTimeoutRef.current  = null; }

    const pc = await createPeer(incomingCall.fromUserId, incomingCall.fromName, stream, false);
    await pc.setRemoteDescription(incomingCall.sdp);

    // Flush any ICE candidates that arrived before we accepted
    const buffered = iceBuffer.current.get(incomingCall.fromUserId) ?? [];
    iceBuffer.current.delete(incomingCall.fromUserId);
    for (const c of buffered) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* ignore */ }
    }

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
    (window as Window & { api?: { overlayHideCall?: () => void } }).api?.overlayHideCall?.();
  }, [incomingCall, wsSend, stopRingtone]);
  // ─── Overlay call listener (accept / decline from overlay window) ─────────────
  const acceptCallRef = useRef<() => void>(() => {});
  useEffect(() => { acceptCallRef.current = acceptCall; }, [acceptCall]);
  const declineCallRef = useRef<() => void>(() => {});
  useEffect(() => { declineCallRef.current = declineCall; }, [declineCall]);

  useEffect(() => {
    type OverlayListenerAPI = {
      onOverlayCallAccepted?: (cb: () => void) => void;
      onOverlayCallDeclined?: (cb: () => void) => void;
    };
    const api = (window as Window & { api?: OverlayListenerAPI }).api;
    api?.onOverlayCallAccepted?.(() => acceptCallRef.current());
    api?.onOverlayCallDeclined?.(() => declineCallRef.current());
  }, []);
  // ─── Screen share ─────────────────────────────────────────────────────────
  const stopScreenShare = useCallback(() => {
    if (!screenStream.current) return;
    const stream = screenStream.current;
    screenSenders.current.forEach((senders, userId) => {
      const peer = peers.current.get(userId);
      if (peer) senders.forEach((s) => { try { peer.pc.removeTrack(s); } catch { /* ignore */ } });
    });
    screenSenders.current.clear();
    stream.getTracks().forEach((t) => t.stop());
    screenStream.current = null;
    setIsScreenSharing(false);
    peers.current.forEach((_, userId) => wsSend({ type: "rtc_screen_stop", to_user_id: userId }));
  }, [wsSend]);

  const openScreenPicker = useCallback(async () => {
    const api = (window as Window & { api?: ScreenElectronAPI }).api;
    if (!api?.getScreenSources) return;
    try {
      const sources = await api.getScreenSources();
      setScreenSources(sources);
      setScreenPickerOpen(true);
    } catch { /* ignore */ }
  }, []);

  const startScreenShare = useCallback(async (sourceId: string) => {
    setScreenPickerOpen(false);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stream = await (navigator.mediaDevices as any).getUserMedia({
        // Capture system/loopback audio when the user opted in
        audio: shareWithAudio ? { mandatory: { chromeMediaSource: "desktop" } } : false,
        video: {
          mandatory: {
            chromeMediaSource: "desktop",
            chromeMediaSourceId: sourceId,
            maxWidth: 1920,
            maxHeight: 1080,
            maxFrameRate: 30,
          },
        },
      }) as MediaStream;
      screenStream.current = stream;
      setIsScreenSharing(true);
      const videoTrack = stream.getVideoTracks()[0];
      videoTrack.onended = () => stopScreenShare();
      const audioTrack = stream.getAudioTracks()[0]; // system audio (only present when shareWithAudio=true)
      for (const [userId, peer] of peers.current) {
        const existing = screenSenders.current.get(userId) ?? [];
        const vSender = peer.pc.addTrack(videoTrack, stream);
        existing.push(vSender);
        if (audioTrack) {
          const aSender = peer.pc.addTrack(audioTrack, stream);
          existing.push(aSender);
        }
        screenSenders.current.set(userId, existing);
        const offer = await peer.pc.createOffer();
        await peer.pc.setLocalDescription(offer);
        if (peer.pc.localDescription) {
          wsSend({ type: "rtc_renego_offer", to_user_id: userId, sdp: peer.pc.localDescription });
        }
      }
    } catch { /* user cancelled or permission denied */ }
  }, [wsSend, stopScreenShare, shareWithAudio]);

  // ─── Per-participant volume ──────────────────────────────────────────────
  const setParticipantVolume = useCallback((userId: number, vol: number) => {
    const peer = peers.current.get(userId);
    if (peer) peer.audioEl.volume = Math.max(0, Math.min(1, vol));
    setParticipantVolumes((prev) => ({ ...prev, [userId]: vol }));
  }, []);

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
        // Relay to overlay — visible even when launcher is not focused
        (window as Window & { api?: { overlayShowCall?: (d: unknown) => void } }).api?.overlayShowCall?.({
          fromUserId: fromId,
          fromName,
          callType:  (msg.call_type as "dm" | "group") ?? "dm",
          groupId:   msg.group_id as number | undefined,
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
        if (peer) {
          try {
            await peer.pc.addIceCandidate(new RTCIceCandidate(msg.candidate as RTCIceCandidateInit));
          } catch { /* ignore late candidates */ }
        } else {
          // No peer yet (callee hasn't accepted) — buffer for later
          const buf = iceBuffer.current.get(fromId) ?? [];
          buf.push(msg.candidate as RTCIceCandidateInit);
          iceBuffer.current.set(fromId, buf);
        }
      } else if (type === "rtc_renego_offer") {
        // Renegotiation offer — remote peer added a screen share track
        const fromId = msg.from_user_id as number;
        const peer   = peers.current.get(fromId);
        if (peer) {
          await peer.pc.setRemoteDescription(msg.sdp as RTCSessionDescriptionInit);
          const answer = await peer.pc.createAnswer();
          await peer.pc.setLocalDescription(answer);
          wsSend({ type: "rtc_renego_answer", to_user_id: fromId, sdp: answer });
        }
      } else if (type === "rtc_renego_answer") {
        const fromId = msg.from_user_id as number;
        const peer   = peers.current.get(fromId);
        if (peer) {
          await peer.pc.setRemoteDescription(msg.sdp as RTCSessionDescriptionInit);
        }
      } else if (type === "rtc_screen_stop") {
        setRemoteScreenStream(null);
        setRemoteScreenFrom(null);
        setRemoteScreenHidden(false);
      } else if (type === "rtc_hang_up" || type === "rtc_group_hang_up") {
        // Dismiss incoming call modal if the caller cancelled before we answered
        stopRingtone();
        setIncomingCall(null);
        (window as Window & { api?: { overlayHideCall?: () => void } }).api?.overlayHideCall?.();
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
            {callStatus === "connected" && (
              <button
                className="btn btn-ghost btn-icon"
                title={isScreenSharing ? "Arrêter le partage d'écran" : "Partager l'écran"}
                onClick={isScreenSharing ? stopScreenShare : openScreenPicker}
                style={{ height: 32, width: 32, color: isScreenSharing ? "var(--color-primary)" : "var(--text-secondary)" }}
              >
                {isScreenSharing ? <MonitorOff size={14} /> : <Monitor size={14} />}
              </button>
            )}
            {/* Re-open button when the overlay was hidden but stream is still active */}
            {remoteScreenStream && remoteScreenHidden && (
              <button
                className="btn btn-ghost btn-icon"
                title={`${remoteScreenFrom} — ${t.callMaximize}`}
                onClick={() => setRemoteScreenHidden(false)}
                style={{ height: 32, width: 32, color: "var(--color-primary)", position: "relative" }}
              >
                <Monitor size={14} />
                <span style={{
                  position: "absolute", top: 4, right: 4,
                  width: 6, height: 6, borderRadius: "50%",
                  background: "var(--color-primary)",
                }} />
              </button>
            )}
            <button
              className="btn"
              style={{ flex: 1, height: 32, fontSize: 12, background: "var(--color-danger)", color: "#fff", border: "none", gap: 6 }}
              onClick={() => hangUpAll(true)}
            >
              <PhoneOff size={13} /> Raccrocher
            </button>
          </div>
          {/* ── Participants volume ──────────────────────────────────── */}
          {callStatus === "connected" && peerList.length > 0 && (
            <div style={{ marginTop: 10, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                {t.callParticipants}
              </div>
              {peerList.map(({ userId, name }) => (
                <div key={userId} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {name}
                  </span>
                  <Volume2 size={11} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                  <input
                    type="range" min={0} max={1} step={0.05}
                    value={participantVolumes[userId] ?? 1}
                    onChange={(e) => setParticipantVolume(userId, parseFloat(e.target.value))}
                    style={{ width: 68 }}
                  />
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* ── Screen source picker modal ───────────────────────────────── */}
      {screenPickerOpen && (
        <motion.div
          key="screen-picker"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: "fixed", inset: 0, zIndex: 10000,
            background: "rgba(0,0,0,0.72)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setScreenPickerOpen(false); }}
        >
          <motion.div
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "20px 24px",
              width: 700,
              maxHeight: "80vh",
              overflowY: "auto",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                {t.callPickScreen}
              </span>
              <button className="btn btn-ghost btn-icon" style={{ height: 28, width: 28 }} onClick={() => setScreenPickerOpen(false)}>
                <X size={14} />
              </button>
            </div>
            {/* Category tabs */}
            <div style={{ display: "flex", gap: 2, marginBottom: 14, borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
              {(["screen", "app"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setScreenPickerTab(tab)}
                  style={{
                    fontSize: 12, padding: "4px 14px", borderRadius: 6, border: "none", cursor: "pointer",
                    background: screenPickerTab === tab ? "var(--color-primary)" : "transparent",
                    color: screenPickerTab === tab ? "#fff" : "var(--text-secondary)",
                    fontWeight: screenPickerTab === tab ? 600 : 400,
                    transition: "background 0.15s, color 0.15s",
                  }}
                >
                  {tab === "screen" ? t.callScreensTab : t.callAppsTab}
                </button>
              ))}
            </div>
            {/* Audio capture toggle */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "8px 12px", background: "var(--bg-elevated)", borderRadius: 8 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}>
                <input
                  type="checkbox"
                  checked={shareWithAudio}
                  onChange={(e) => setShareWithAudio(e.target.checked)}
                  style={{ width: 14, height: 14, cursor: "pointer" }}
                />
                <Volume2 size={13} style={{ color: "var(--text-muted)" }} />
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{t.callShareAudio}</span>
              </label>
            </div>
            {/* Thumbnails grid — filtered by active tab */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 12 }}>
              {screenSources
                .filter((src) => screenPickerTab === "screen" ? src.id.startsWith("screen:") : !src.id.startsWith("screen:"))
                .map((src) => (
                  <button
                    key={src.id}
                    onClick={() => startScreenShare(src.id)}
                    style={{
                      background: "var(--bg-elevated)",
                      border: "2px solid var(--border)",
                      borderRadius: 8, padding: 8, cursor: "pointer",
                      textAlign: "center", transition: "border-color 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--color-primary)")}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                  >
                    <img
                      src={src.thumbnail} alt={src.name}
                      style={{ width: "100%", height: 110, objectFit: "contain", borderRadius: 4, background: "#000" }}
                    />
                    <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 4, justifyContent: "center" }}>
                      {src.appIcon && <img src={src.appIcon} alt="" style={{ width: 14, height: 14, flexShrink: 0 }} />}
                      <span style={{ fontSize: 11, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 150 }}>
                        {src.name}
                      </span>
                    </div>
                  </button>
                ))}
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* ── Remote screen share overlay ────────────────────────────── */}
      {remoteScreenStream && !remoteScreenHidden && (
        <motion.div
          key="remote-screen"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          style={{
            position: "fixed",
            ...(screenMinimized
              ? { bottom: 20, left: 20, width: 300, height: 170, zIndex: 8900 }
              : { inset: 36, zIndex: 8900 }),
            background: "#000",
            borderRadius: 10,
            border: "1px solid var(--border)",
            overflow: "hidden",
            boxShadow: "0 16px 48px rgba(0,0,0,0.8)",
            transition: "all 0.2s ease",
          }}
        >
          <video
            ref={(el) => {
              remoteVideoRef.current = el;
              // Attach srcObject immediately on mount — useEffect alone can miss
              // the case where the element remounts (hide→show) without stream changing.
              if (el && remoteScreenStream) {
                el.srcObject = remoteScreenStream;
                el.volume = remoteVideoVolume;
                el.play().catch(() => {});
              }
            }}
            autoPlay
            playsInline
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
          {/* Overlay controls bar */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0,
            padding: "6px 10px",
            background: "linear-gradient(to bottom, rgba(0,0,0,0.65), transparent)",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ fontSize: 11, color: "#fff", opacity: 0.9, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              🖥️ {remoteScreenFrom} {t.callSharingFrom}
            </span>
            {/* Audio volume for screen share */}
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }} title={t.callAudioVolume}>
              <Volume2 size={11} style={{ color: "#fff", opacity: 0.7 }} />
              <input
                type="range" min={0} max={1} step={0.05}
                value={remoteVideoVolume}
                onChange={(e) => setRemoteVideoVolume(parseFloat(e.target.value))}
                style={{ width: 64 }}
              />
            </div>
            <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
              <button
                className="btn btn-ghost btn-icon"
                style={{ height: 24, width: 24, color: "#fff" }}
                title={screenMinimized ? t.callMaximize : t.callMinimize}
                onClick={() => setScreenMinimized((m) => !m)}
              >
                {screenMinimized ? <Monitor size={12} /> : <MonitorOff size={12} />}
              </button>
              <button
                className="btn btn-ghost btn-icon"
                style={{ height: 24, width: 24, color: "#fff" }}
                title={t.callHideView}
                onClick={() => setRemoteScreenHidden(true)}
              >
                <X size={12} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
