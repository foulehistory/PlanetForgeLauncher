import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, UserPlus, ArrowLeft, Send, Users, Check, SmilePlus, Film, UserMinus, Bell, Hash, Plus, Trash2, LogOut, UserCheck, Phone } from "lucide-react";
import { useI18n } from "./i18n";
import { useNotificationHelpers } from "./Notifications";
import EmojiPicker from "./EmojiPicker";
import GifPicker from "./GifPicker";

import { API_BASE } from "../config";

const API = API_BASE;

// -- Helpers -------------------------------------------------------------------
function getToken(): string | null {
  const rememberMe = localStorage.getItem("remember-me") === "true";
  return (rememberMe ? localStorage : sessionStorage).getItem("auth-token");
}

function getMyUserId(): number | null {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return parseInt(payload.user_id);
  } catch {
    return null;
  }
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T | null> {
  const token = getToken();
  try {
    const res = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(options?.headers ?? {}),
      },
    });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

// -- Markdown renderer ---------------------------------------------------------
type MdToken = { t: "text" | "bold" | "italic" | "code"; v: string };

function tokenizeMd(text: string): MdToken[] {
  const tokens: MdToken[] = [];
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`/g;
  let last = 0, match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) tokens.push({ t: "text", v: text.slice(last, match.index) });
    if (match[1] !== undefined)      tokens.push({ t: "bold",   v: match[1] });
    else if (match[2] !== undefined) tokens.push({ t: "italic", v: match[2] });
    else if (match[3] !== undefined) tokens.push({ t: "code",   v: match[3] });
    last = match.index + match[0].length;
  }
  if (last < text.length) tokens.push({ t: "text", v: text.slice(last) });
  return tokens;
}

function MarkdownText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, li) => (
        <span key={li}>
          {li > 0 && <br />}
          {tokenizeMd(line).map((tok, i) => {
            if (tok.t === "bold")   return <strong key={i}>{tok.v}</strong>;
            if (tok.t === "italic") return <em key={i}>{tok.v}</em>;
            if (tok.t === "code")   return <code key={i} className="md-code">{tok.v}</code>;
            return <span key={i}>{tok.v}</span>;
          })}
        </span>
      ))}
    </>
  );
}

// -- Types ---------------------------------------------------------------------
const STATUSES: Array<{ value: string; label: string; color: string }> = [
  { value: "online",    label: "En ligne",        color: "#4caf50" },
  { value: "away",      label: "Absent",           color: "#ffc107" },
  { value: "busy",      label: "Ne pas déranger",  color: "#f44336" },
  { value: "invisible", label: "Invisible",        color: "#607d8b" },
];

interface FriendData {
  friendship_id: number;
  friend_id: number;
  username: string;
  display_name: string | null;
  friend_code: string;
  avatar_path: string | null;
  status: string;
  last_seen?: string | null;
}

function isOnline(f: FriendData, onlineIds: Set<number>): boolean {
  return onlineIds.has(f.friend_id);
}

function friendStatusColor(online: boolean, status: string): string {
  if (!online) return "var(--text-muted)";
  switch (status) {
    case "away":    return "#ffc107";
    case "busy":    return "#f44336";
    default:        return "#4caf50"; // online
  }
}

function friendStatusLabel(online: boolean, status: string, labels: { online: string; offline: string }): string {
  if (!online) return labels.offline;
  switch (status) {
    case "away": return "Absent";
    case "busy": return "Ne pas déranger";
    default:     return labels.online;
  }
}

interface FriendRequest {
  friendship_id: number;
  requester_id: number;
  username: string;
  display_name: string | null;
  friend_code: string;
  avatar_path: string | null;
  created_at: string;
}

interface GroupData {
  id: number;
  name: string;
  created_by: number;
  member_count: number;
  unread_count: number;
  created_at: string;
}

interface GroupMemberInfo {
  user_id: number;
  username: string;
  display_name: string | null;
  role: string;
}

interface GroupMessageData {
  id: number;
  sender_id: number;
  content: string | null;
  gif_url: string | null;
  created_at: string;
  username: string;
  display_name: string | null;
}

interface MessageData {
  id: number;
  sender_id: number;
  content: string | null;
  gif_url: string | null;
  is_read: boolean;
  created_at: string;
  username: string;
  display_name: string | null;
}

// -- FriendAvatar --------------------------------------------------------------
function FriendAvatar({ name, size = 32, userId }: { name: string; size?: number; userId?: number }) {
  const [imgError, setImgError] = useState(false);
  const initials = name
    .split(/[\s_]+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const avatarSrc = userId && !imgError ? `${API}/api/users/${userId}/avatar` : null;
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: "var(--accent-dim)", border: "1.5px solid var(--accent)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.34, fontWeight: 700, color: "var(--accent)", userSelect: "none",
      overflow: "hidden",
    }}>
      {avatarSrc ? (
        <img
          src={avatarSrc}
          alt={name}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          onError={() => setImgError(true)}
        />
      ) : (
        initials
      )}
    </div>
  );
}

// -- FriendsPanel --------------------------------------------------------------
export default function FriendsPanel({ isOpen, onClose, reloadKey, onlineUserIds = new Set() }: { isOpen: boolean; onClose: () => void; reloadKey?: number; onlineUserIds?: Set<number> }) {
  const { t } = useI18n();
  const notify = useNotificationHelpers();
  const myId = getMyUserId();

  // -- Data state ----------------------------------------------
  const [friends,  setFriends]  = useState<FriendData[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // -- UI state ------------------------------------------------
  const [view, setView]               = useState<"list" | "chat" | "group-chat">("list");
  const [tab,  setTab]                = useState<"friends" | "groups" | "requests">("friends");
  const [activeFriend, setActiveFriend] = useState<FriendData | null>(null);
  const [activeGroup,  setActiveGroup]  = useState<GroupData | null>(null);

  // -- Group state ----------------------------------------------
  const [groups,            setGroups]            = useState<GroupData[]>([]);
  const [groupMessages,     setGroupMessages]     = useState<GroupMessageData[]>([]);
  const [groupMsgInput,     setGroupMsgInput]     = useState("");
  const [groupMsgLoading,   setGroupMsgLoading]   = useState(false);
  const [creatingGroup,     setCreatingGroup]     = useState(false);
  const [newGroupName,      setNewGroupName]      = useState("");
  const [newGroupMembers,   setNewGroupMembers]   = useState<Set<number>>(new Set());
  const [createGroupStatus, setCreateGroupStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");

  // -- Add member to group state --------------------------------
  const [addingMember,      setAddingMember]      = useState(false);
  const [groupMembers,      setGroupMembers]      = useState<GroupMemberInfo[]>([]);
  const [addMemberStatus,   setAddMemberStatus]   = useState<Record<number, "loading" | "ok" | "error">>({}); 

  // -- Confirm dialog ------------------------------------------
  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const showConfirm = (message: string, onConfirm: () => void) =>
    setConfirmDialog({ message, onConfirm });

  // -- Own status ------------------------------------------------
  const [myStatus,         setMyStatus]         = useState<string>("online");
  const [statusPickerOpen, setStatusPickerOpen] = useState(false);
  const statusPickerRef = useRef<HTMLDivElement>(null);

  // -- Add friend form -----------------------------------------
  const [adding,     setAdding]     = useState(false);
  const [friendCode, setFriendCode] = useState("");
  const [addStatus,  setAddStatus]  = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [addError,   setAddError]   = useState("");

  // -- Chat state ----------------------------------------------
  const [messages,        setMessages]        = useState<MessageData[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messageInput,    setMessageInput]    = useState("");
  const [showEmoji,       setShowEmoji]       = useState(false);
  const [showGif,         setShowGif]         = useState(false);
  const inputRef  = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const activeFriendRef = useRef(activeFriend);

  // -- Fetch own status on mount --------------------------------
  useEffect(() => {
    apiFetch<{ status: string }>("/api/users/me").then((data) => {
      if (data?.status) setMyStatus(data.status);
    });
  }, []);

  // -- Close status picker on outside click --------------------
  useEffect(() => {
    if (!statusPickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (statusPickerRef.current && !statusPickerRef.current.contains(e.target as Node)) {
        setStatusPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [statusPickerOpen]);

  // -- Fetch friends + requests --------------------------------
  const loadData = useCallback(async () => {
    setDataLoading(true);
    const [fr, req, gr] = await Promise.all([
      apiFetch<FriendData[]>("/api/friends/"),
      apiFetch<FriendRequest[]>("/api/friends/requests"),
      apiFetch<GroupData[]>("/api/groups"),
    ]);
    if (fr)  setFriends(fr);
    if (req) setRequests(req);
    if (gr)  setGroups(gr);
    setDataLoading(false);
  }, []);

  useEffect(() => {
    if (isOpen) loadData();
  }, [isOpen, loadData]);

  // Reload when an external action changes reloadKey (e.g. accept from notification)
  useEffect(() => {
    if (isOpen && reloadKey !== undefined && reloadKey > 0) loadData();
  }, [reloadKey, isOpen, loadData]);

  // Auto-refresh friends list every 30s while panel is open (picks up new friends/status)
  useEffect(() => {
    if (!isOpen) return;
    const id = setInterval(loadData, 30_000);
    return () => clearInterval(id);
  }, [isOpen, loadData]);

  // -- Reset on close ------------------------------------------
  useEffect(() => {
    if (!isOpen) {
      const id = setTimeout(() => {
        setView("list");
        setActiveFriend(null);
        setActiveGroup(null);
        setAdding(false);
        setFriendCode("");
        setAddStatus("idle");
        setMessages([]);
        setGroupMessages([]);
        setGroupMsgInput("");
        setCreatingGroup(false);
        setNewGroupName("");
        setNewGroupMembers(new Set());
        setShowEmoji(false);
        setShowGif(false);
      }, 280);
      return () => clearTimeout(id);
    }
  }, [isOpen]);

  // -- Poll messages -------------------------------------------
  // Keep activeFriendRef current so WS handler closure always has latest value
  useEffect(() => { activeFriendRef.current = activeFriend; }, [activeFriend]);
  const activeGroupRef = useRef(activeGroup);
  useEffect(() => { activeGroupRef.current = activeGroup; }, [activeGroup]);

  // -- WS: real-time messages -------------------------------------
  useEffect(() => {
    const handler = (e: Event) => {
      const msg = (e as CustomEvent).detail as {
        type: string;
        friendship_id?: number;
        message?: MessageData;
        user_id?: number;
        status?: string;
        group_id?: number;
        name?: string;
      };
      if (msg.type === "new_message") {
        if (msg.friendship_id !== activeFriendRef.current?.friendship_id) return;
        const incoming = msg.message!;
        setMessages((prev) =>
          prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]
        );
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      } else if (msg.type === "friend_status" && msg.user_id && msg.status) {
        // Real-time status update from PATCH /me/status or reconnect
        setFriends((prev) =>
          prev.map((f) =>
            f.friend_id === msg.user_id ? { ...f, status: msg.status! } : f
          )
        );
      } else if (msg.type === "group_message") {
        const gid = msg.group_id as number;
        if (activeGroupRef.current?.id === gid) {
          const incoming = msg.message as GroupMessageData;
          setGroupMessages((prev) =>
            prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]
          );
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
        } else {
          setGroups((prev) =>
            prev.map((g) => g.id === gid ? { ...g, unread_count: (g.unread_count || 0) + 1 } : g)
          );
        }
      } else if (msg.type === "group_created" || msg.type === "group_member_added" || msg.type === "group_member_removed") {
        apiFetch<GroupData[]>("/api/groups").then((gr) => { if (gr) setGroups(gr); });
      } else if (msg.type === "group_renamed") {
        const gid  = msg.group_id as number;
        const name = msg.name as string;
        setGroups((prev) => prev.map((g) => g.id === gid ? { ...g, name } : g));
        setActiveGroup((ag) => ag?.id === gid ? { ...ag, name } : ag);
      } else if (msg.type === "group_deleted") {
        const gid = msg.group_id as number;
        setGroups((prev) => prev.filter((g) => g.id !== gid));
        if (activeGroupRef.current?.id === gid) setView("list");
      }
    };
    window.addEventListener("ws:message", handler);
    return () => window.removeEventListener("ws:message", handler);
  }, []);

  // -- Fetch messages (history on chat open + after send) ------------------
  const fetchMessages = useCallback(async (fid: number) => {
    const data = await apiFetch<MessageData[]>(`/api/messages/${fid}`);
    if (data) {
      setMessages(data);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }, []);

  useEffect(() => {
    if (view !== "chat" || !activeFriend) return;
    setMessagesLoading(true);
    fetchMessages(activeFriend.friendship_id).finally(() => setMessagesLoading(false));
    // No polling — WS delivers new messages in real-time
  }, [view, activeFriend, fetchMessages]);

  // -- Close pickers on outside click -------------------------
  useEffect(() => {
    if (!showEmoji && !showGif) return;
    const hide = () => { setShowEmoji(false); setShowGif(false); };
    document.addEventListener("click", hide, { capture: true });
    return () => document.removeEventListener("click", hide, { capture: true });
  }, [showEmoji, showGif]);

  // -- Actions -------------------------------------------------
  const openChat = (friend: FriendData) => {
    setActiveFriend(friend);
    setMessages([]);
    setView("chat");
  };

  const sendFriendRequest = async () => {
    if (friendCode.replace("-", "").length < 8) return;
    setAddStatus("loading");
    const res = await fetch(`${API}/api/friends/request`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ friend_code: friendCode }),
    });
    if (res.ok) {
      setAddStatus("ok");
      setTimeout(() => { setAddStatus("idle"); setFriendCode(""); setAdding(false); }, 2000);
    } else {
      const json = await res.json().catch(() => ({}));
      setAddError((json as { detail?: string }).detail ?? "Erreur");
      setAddStatus("error");
      setTimeout(() => setAddStatus("idle"), 3000);
    }
  };

  const acceptRequest = async (fid: number) => {
    await apiFetch(`/api/friends/${fid}/accept`, { method: "PATCH" });
    await loadData();
  };

  const declineRequest = async (fid: number) => {
    await apiFetch(`/api/friends/${fid}/decline`, { method: "PATCH" });
    await loadData();
  };

  const removeFriend = async (fid: number) => {
    await apiFetch(`/api/friends/${fid}`, { method: "DELETE" });
    await loadData();
    if (activeFriend?.friendship_id === fid) setView("list");
  };

  const insertAtCursor = (text: string) => {
    const input = inputRef.current;
    if (!input) { setMessageInput((p) => p + text); return; }
    const s = input.selectionStart ?? messageInput.length;
    const e = input.selectionEnd   ?? messageInput.length;
    const next = messageInput.slice(0, s) + text + messageInput.slice(e);
    setMessageInput(next);
    setTimeout(() => { input.focus(); input.setSelectionRange(s + text.length, s + text.length); }, 0);
  };

  const sendMessage = async (gifUrl?: string) => {
    if (!activeFriend) return;
    const content = messageInput.trim();
    if (!content && !gifUrl) return;

    const fid = activeFriend.friendship_id; // capture before awaits

    setMessageInput("");
    setShowEmoji(false);
    setShowGif(false);

    // Optimistic — placé immédiatement
    const optimisticId = Date.now();
    const optimistic: MessageData = {
      id: optimisticId,
      sender_id: myId ?? 0,
      content: content || null,
      gif_url: gifUrl ?? null,
      is_read: true,
      created_at: new Date().toISOString(),
      username: "me",
      display_name: null,
    };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    try {
      const res = await fetch(`${API}/api/messages/${fid}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ content: content || null, gif_url: gifUrl ?? null }),
      });
      if (res.ok) {
        await fetchMessages(fid);
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        notify.error("Message", "Impossible d'envoyer le message");
      }
    } catch {
      // Network error — keep optimistic message visible
    }
  };

  // -- Group actions --------------------------------------------
  const openGroupChat = async (group: GroupData) => {
    setActiveGroup(group);
    setGroupMessages([]);
    setAddingMember(false);
    setView("group-chat");
    setGroupMsgLoading(true);
    // Load messages + members in parallel
    const [msgs, info] = await Promise.all([
      apiFetch<GroupMessageData[]>(`/api/groups/${group.id}/messages`),
      apiFetch<{ members: GroupMemberInfo[] }>(`/api/groups/${group.id}`),
    ]);
    if (msgs) {
      setGroupMessages(msgs);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
    if (info) setGroupMembers(info.members);
    setGroupMsgLoading(false);
    setGroups((prev) => prev.map((g) => g.id === group.id ? { ...g, unread_count: 0 } : g));
  };

  const sendGroupMessage = async (gifUrl?: string) => {
    if (!activeGroup) return;
    const content = groupMsgInput.trim();
    if (!content && !gifUrl) return;
    const gid = activeGroup.id;
    setGroupMsgInput("");
    setShowEmoji(false);
    setShowGif(false);
    const optimisticId = Date.now();
    const optimistic: GroupMessageData = {
      id: optimisticId, sender_id: myId ?? 0,
      content: content || null, gif_url: gifUrl ?? null,
      created_at: new Date().toISOString(), username: "me", display_name: null,
    };
    setGroupMessages((prev) => [...prev, optimistic]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    try {
      const res = await fetch(`${API}/api/groups/${gid}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ content: content || null, gif_url: gifUrl ?? null }),
      });
      if (res.ok) {
        const data = await apiFetch<GroupMessageData[]>(`/api/groups/${gid}/messages`);
        if (data) setGroupMessages(data);
      } else {
        setGroupMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        notify.error("Message", "Impossible d'envoyer le message");
      }
    } catch { /* keep optimistic */ }
  };

  const createGroup = async () => {
    const name = newGroupName.trim();
    if (!name || newGroupMembers.size === 0) return;
    setCreateGroupStatus("loading");
    const res = await fetch(`${API}/api/groups`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name, member_ids: [...newGroupMembers] }),
    });
    if (res.ok) {
      const gr = await res.json() as GroupData;
      setCreateGroupStatus("ok");
      await loadData();
      setTimeout(() => {
        setCreatingGroup(false); setNewGroupName(""); setNewGroupMembers(new Set()); setCreateGroupStatus("idle");
      }, 1200);
      openGroupChat({ ...gr, member_count: newGroupMembers.size + 1, unread_count: 0 });
    } else {
      const json = await res.json().catch(() => ({}));
      notify.error("Groupe", (json as { detail?: string }).detail ?? "Erreur");
      setCreateGroupStatus("idle");
    }
  };

  const toggleGroupMember = (uid: number) =>
    setNewGroupMembers((prev) => { const next = new Set(prev); next.has(uid) ? next.delete(uid) : next.add(uid); return next; });

  const openAddMember = async () => {
    if (!activeGroup) return;
    const data = await apiFetch<{ members: GroupMemberInfo[] }>(`/api/groups/${activeGroup.id}`);
    if (data) setGroupMembers(data.members);
    setAddMemberStatus({});
    setAddingMember(true);
  };

  const addMemberToGroup = async (uid: number) => {
    if (!activeGroup) return;
    setAddMemberStatus((p) => ({ ...p, [uid]: "loading" }));
    const res = await fetch(`${API}/api/groups/${activeGroup.id}/members`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: uid }),
    });
    if (res.ok) {
      setAddMemberStatus((p) => ({ ...p, [uid]: "ok" }));
      setActiveGroup((ag) => ag ? { ...ag, member_count: ag.member_count + 1 } : ag);
      const data = await apiFetch<{ members: GroupMemberInfo[] }>(`/api/groups/${activeGroup.id}`);
      if (data) setGroupMembers(data.members);
      loadData();
    } else {
      setAddMemberStatus((p) => ({ ...p, [uid]: "error" }));
    }
  };

  const handleMyStatusChange = async (newStatus: string) => {
    if (newStatus === myStatus) { setStatusPickerOpen(false); return; }
    setMyStatus(newStatus);
    setStatusPickerOpen(false);
    const token = getToken();
    await fetch(`${API}/api/users/me/status`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
  };

  const displayName = (f: FriendData | FriendRequest) => f.display_name || f.username;
  const pendingCount = requests.length;

  // -- Render ---------------------------------------------------
  return (
    <>
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.96 }}
          transition={{ type: "spring", damping: 28, stiffness: 380, mass: 0.8 }}
          style={{
            position: "fixed", bottom: 46, right: 16,
            width: 308, height: 450, zIndex: 500,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
            display: "flex", flexDirection: "column", overflow: "hidden",
          }}
        >
          <AnimatePresence mode="wait">

            {/* ---- LIST VIEW ---- */}
            {view === "list" && (
              <motion.div key="list"
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.13 }}
                style={{ display: "flex", flexDirection: "column", height: "100%" }}
              >
                {/* Header tabs */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className={`fp-tab${tab === "friends" ? " active" : ""}`} onClick={() => setTab("friends")}>
                      <Users size={12} /> {t.friendsTabFriends}
                      {friends.length > 0 && <span className="fp-badge">{friends.length}</span>}
                    </button>
                    <button className={`fp-tab${tab === "groups" ? " active" : ""}`} onClick={() => setTab("groups")}>
                      <Hash size={12} /> Groupes
                      {groups.reduce((s, g) => s + (g.unread_count > 0 ? 1 : 0), 0) > 0 && (
                        <span className="fp-badge fp-badge-warn">
                          {groups.reduce((s, g) => s + (g.unread_count > 0 ? 1 : 0), 0)}
                        </span>
                      )}
                    </button>
                    <button className={`fp-tab${tab === "requests" ? " active" : ""}`} onClick={() => setTab("requests")}>
                      <Bell size={12} /> {t.friendsTabRequests}
                      {pendingCount > 0 && <span className="fp-badge fp-badge-warn">{pendingCount}</span>}
                    </button>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {/* Status dot — click to change own presence */}
                    <div style={{ position: "relative" }} ref={statusPickerRef}>
                      <button
                        onClick={() => setStatusPickerOpen((o) => !o)}
                        title={`Mon statut : ${STATUSES.find((s) => s.value === myStatus)?.label ?? myStatus}`}
                        style={{
                          width: 18, height: 18, borderRadius: "50%",
                          background: STATUSES.find((s) => s.value === myStatus)?.color ?? "#4caf50",
                          border: "2.5px solid var(--bg-elevated)",
                          cursor: "pointer", padding: 0, flexShrink: 0,
                          outline: "none",
                          boxShadow: statusPickerOpen
                            ? `0 0 0 3px ${(STATUSES.find((s) => s.value === myStatus)?.color ?? "#4caf50")}44`
                            : "none",
                          transition: "box-shadow 0.15s",
                        }}
                      />
                      <AnimatePresence>
                        {statusPickerOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -4, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -4, scale: 0.95 }}
                            transition={{ duration: 0.1 }}
                            style={{
                              position: "absolute", right: 0, top: "calc(100% + 8px)",
                              background: "var(--bg-elevated)",
                              border: "1px solid var(--border)",
                              borderRadius: 8,
                              boxShadow: "0 8px 28px rgba(0,0,0,0.45)",
                              padding: 4,
                              minWidth: 178,
                              zIndex: 600,
                            }}
                          >
                            {STATUSES.map((s) => (
                              <button
                                key={s.value}
                                onClick={() => handleMyStatusChange(s.value)}
                                style={{
                                  display: "flex", alignItems: "center", gap: 9,
                                  width: "100%", padding: "7px 10px",
                                  background: myStatus === s.value ? "var(--accent-dim)" : "transparent",
                                  border: "none", borderRadius: 6,
                                  cursor: "pointer",
                                  color: myStatus === s.value ? "var(--accent)" : "var(--text-primary)",
                                  fontSize: 12,
                                  transition: "background 0.1s",
                                }}
                              >
                                <span style={{ width: 9, height: 9, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                                {s.label}
                                {myStatus === s.value && <Check size={10} style={{ marginLeft: "auto", opacity: 0.6 }} />}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <button className="btn btn-ghost btn-icon" onClick={onClose} style={{ opacity: 0.5 }}>
                      <X size={13} />
                    </button>
                  </div>
                </div>

                {/* -- Friends tab -- */}
                {tab === "friends" && (
                  <>
                    <div style={{ padding: "9px 14px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
                      <AnimatePresence mode="wait">
                        {adding ? (
                          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }}>
                            <div style={{ display: "flex", gap: 5 }}>
                              <input
                                className="input"
                                placeholder={t.friendsAddPlaceholder}
                                value={friendCode}
                                onChange={(e) => setFriendCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))}
                                onKeyDown={(e) => e.key === "Enter" && sendFriendRequest()}
                                maxLength={9} autoFocus
                                style={{ flex: 1, height: 30, fontSize: 12, fontFamily: "monospace", letterSpacing: "0.07em" }}
                              />
                              <button className="btn btn-primary btn-icon" onClick={sendFriendRequest}
                                disabled={addStatus === "loading" || friendCode.replace("-", "").length < 8}
                                style={{ height: 30, width: 30 }}>
                                {addStatus === "ok" ? <Check size={12} /> : <Send size={12} />}
                              </button>
                              <button className="btn btn-ghost btn-icon" onClick={() => { setAdding(false); setFriendCode(""); }} style={{ height: 30, width: 30, opacity: 0.5 }}>
                                <X size={12} />
                              </button>
                            </div>
                            {addStatus === "ok"    && <p style={{ fontSize: 10, color: "var(--color-success)", marginTop: 5 }}>Demande envoyee !</p>}
                            {addStatus === "error" && <p style={{ fontSize: 10, color: "var(--color-danger)",  marginTop: 5 }}>{addError}</p>}
                          </motion.div>
                        ) : (
                          <motion.button key="btn" className="btn btn-ghost" onClick={() => setAdding(true)}
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }}
                            style={{ width: "100%", justifyContent: "center", fontSize: 12, height: 30 }}>
                            <UserPlus size={13} /> {t.friendsAdd}
                          </motion.button>
                        )}
                      </AnimatePresence>
                    </div>

                    <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
                      {dataLoading ? (
                        <div className="fp-empty"><span style={{ fontSize: 12, color: "var(--text-muted)" }}>...</span></div>
                      ) : friends.length === 0 ? (
                        <div className="fp-empty">
                          <Users size={28} style={{ opacity: 0.3 }} />
                          <span style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>{t.friendsNoFriends}</span>
                        </div>
                      ) : (
                        [...friends].sort((a, b) => (isOnline(b, onlineUserIds) ? 1 : 0) - (isOnline(a, onlineUserIds) ? 1 : 0)).map((f) => {
                          const online = isOnline(f, onlineUserIds);
                          const dotColor = friendStatusColor(online, f.status || "online");
                          const statusText = friendStatusLabel(online, f.status || "online", { online: t.friendsOnline, offline: t.friendsOffline });
                          return (
                          <div key={f.friendship_id} className="friend-row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 14px" }}>
                            <button onClick={() => openChat(f)} style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                              <div style={{ position: "relative", flexShrink: 0 }}>
                                <FriendAvatar name={displayName(f)} userId={f.friend_id} />
                                <span style={{
                                  position: "absolute", bottom: 1, right: 1,
                                  width: 8, height: 8, borderRadius: "50%",
                                  background: dotColor,
                                  border: "1.5px solid var(--bg-elevated)",
                                }} />
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {displayName(f)}
                                </div>
                                <div style={{ fontSize: 10, color: dotColor }}>
                                  {statusText}
                                </div>
                              </div>
                            </button>
                            <button className="btn btn-ghost btn-icon" onClick={() => removeFriend(f.friendship_id)} title={t.friendsRemove} style={{ opacity: 0.35, flexShrink: 0 }}>
                              <UserMinus size={13} />
                            </button>
                          </div>
                        );})
                      )}
                    </div>
                  </>
                )}

                {/* -- Groups tab -- */}
                {tab === "groups" && (
                  <>
                    {/* Create group form or button */}
                    <div style={{ padding: "9px 14px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
                      <AnimatePresence mode="wait">
                        {creatingGroup ? (
                          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }}>
                            <div style={{ display: "flex", gap: 5, marginBottom: 8 }}>
                              <input
                                className="input"
                                placeholder="Nom du groupe…"
                                value={newGroupName}
                                onChange={(e) => setNewGroupName(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && createGroup()}
                                maxLength={100} autoFocus
                                style={{ flex: 1, height: 30, fontSize: 12 }}
                              />
                              <button className="btn btn-primary btn-icon" onClick={createGroup}
                                disabled={createGroupStatus === "loading" || !newGroupName.trim() || newGroupMembers.size === 0}
                                style={{ height: 30, width: 30 }}>
                                {createGroupStatus === "ok" ? <Check size={12} /> : <Plus size={12} />}
                              </button>
                              <button className="btn btn-ghost btn-icon" onClick={() => { setCreatingGroup(false); setNewGroupName(""); setNewGroupMembers(new Set()); }}
                                style={{ height: 30, width: 30, opacity: 0.5 }}>
                                <X size={12} />
                              </button>
                            </div>
                            {/* Friend selector */}
                            <div style={{ maxHeight: 140, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
                              {friends.length === 0 ? (
                                <span style={{ fontSize: 11, color: "var(--text-muted)", padding: "4px 2px" }}>Aucun ami à ajouter</span>
                              ) : friends.map((f) => {
                                const sel = newGroupMembers.has(f.friend_id);
                                return (
                                  <button key={f.friend_id} onClick={() => toggleGroupMember(f.friend_id)}
                                    style={{
                                      display: "flex", alignItems: "center", gap: 8, padding: "5px 6px",
                                      background: sel ? "var(--accent-dim)" : "transparent",
                                      border: `1px solid ${sel ? "var(--accent)" : "transparent"}`,
                                      borderRadius: 6, cursor: "pointer", textAlign: "left",
                                    }}>
                                    <FriendAvatar name={f.display_name || f.username} size={22} userId={f.friend_id} />
                                    <span style={{ fontSize: 12, color: sel ? "var(--accent)" : "var(--text-primary)", flex: 1 }}>{f.display_name || f.username}</span>
                                    {sel && <Check size={11} style={{ color: "var(--accent)", flexShrink: 0 }} />}
                                  </button>
                                );
                              })}
                            </div>
                            {newGroupMembers.size > 0 && (
                              <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 5 }}>
                                {newGroupMembers.size} ami{newGroupMembers.size > 1 ? "s" : ""} sélectionné{newGroupMembers.size > 1 ? "s" : ""}
                              </p>
                            )}
                          </motion.div>
                        ) : (
                          <motion.button key="btn" className="btn btn-ghost" onClick={() => setCreatingGroup(true)}
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }}
                            style={{ width: "100%", justifyContent: "center", fontSize: 12, height: 30 }}>
                            <Plus size={13} /> Créer un groupe
                          </motion.button>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Groups list */}
                    <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
                      {groups.length === 0 ? (
                        <div className="fp-empty">
                          <Hash size={28} style={{ opacity: 0.3 }} />
                          <span style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>Aucun groupe</span>
                        </div>
                      ) : groups.map((g) => (
                        <div key={g.id} className="friend-row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 14px" }}>
                          <button onClick={() => openGroupChat(g)} style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                            {/* Group icon */}
                            <div style={{
                              width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                              background: "var(--accent-dim)", border: "1.5px solid var(--accent)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}>
                              <Hash size={14} style={{ color: "var(--accent)" }} />
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {g.name}
                              </div>
                              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                                {g.member_count} membre{g.member_count > 1 ? "s" : ""}
                              </div>
                            </div>
                            {g.unread_count > 0 && (
                              <span style={{ background: "var(--accent)", color: "white", borderRadius: 8, padding: "0 5px", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                                {g.unread_count}
                              </span>
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* -- Requests tab -- */}
                {tab === "requests" && (
                  <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
                    {requests.length === 0 ? (
                      <div className="fp-empty">
                        <Bell size={24} style={{ opacity: 0.3 }} />
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{t.friendsRequestsEmpty}</span>
                      </div>
                    ) : (
                      requests.map((r) => (
                        <div key={r.friendship_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", borderBottom: "1px solid var(--border)" }}>
                          <FriendAvatar name={displayName(r)} size={34} userId={r.requester_id} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{displayName(r)}</div>
                            <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace" }}>{r.friend_code}</div>
                          </div>
                          <button className="btn btn-primary btn-icon" onClick={() => acceptRequest(r.friendship_id)} title={t.friendsAccept} style={{ height: 28, width: 28 }}>
                            <Check size={12} />
                          </button>
                          <button className="btn btn-ghost btn-icon" onClick={() => declineRequest(r.friendship_id)} title={t.friendsDecline} style={{ height: 28, width: 28, opacity: 0.5 }}>
                            <X size={12} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* ---- CHAT VIEW ---- */}
            {view === "chat" && activeFriend && (
              <motion.div key="chat"
                initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.13 }}
                style={{ display: "flex", flexDirection: "column", height: "100%" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
                  <button className="btn btn-ghost btn-icon" onClick={() => setView("list")} style={{ opacity: 0.65 }}>
                    <ArrowLeft size={13} />
                  </button>
                  <FriendAvatar name={displayName(activeFriend)} userId={activeFriend.friend_id} />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {displayName(activeFriend)}
                  </span>
                  {/* Voice call button */}
                  <button
                    className="btn btn-ghost btn-icon"
                    title="Appel vocal"
                    onClick={() => window.dispatchEvent(new CustomEvent("voice:call", {
                      detail: { type: "dm", toUserId: activeFriend.friend_id, toName: displayName(activeFriend) }
                    }))}
                    style={{ opacity: 0.6 }}
                  >
                    <Phone size={13} />
                  </button>
                  <button className="btn btn-ghost btn-icon" onClick={onClose} style={{ opacity: 0.5 }}>
                    <X size={13} />
                  </button>
                </div>

                {/* Messages */}
                <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                  {messagesLoading && messages.length === 0 ? (
                    <div className="fp-empty"><span style={{ fontSize: 11, color: "var(--text-muted)" }}>...</span></div>
                  ) : messages.length === 0 ? (
                    <div className="fp-empty"><span style={{ fontSize: 11, color: "var(--text-muted)" }}>{t.friendsChatStart}</span></div>
                  ) : (
                    messages.map((m) => {
                      const fromMe = m.sender_id === myId || m.username === "me";
                      return (
                        <div key={m.id} style={{ display: "flex", justifyContent: fromMe ? "flex-end" : "flex-start" }}>
                          {!fromMe && (
                            <div style={{ marginRight: 6, flexShrink: 0, alignSelf: "flex-end" }}>
                              <FriendAvatar name={m.display_name || m.username} size={22} userId={m.sender_id} />
                            </div>
                          )}
                          <div className={`msg-bubble ${fromMe ? "msg-mine" : "msg-theirs"}`}>
                            {m.gif_url ? (
                              <img src={m.gif_url} alt="GIF" style={{ maxWidth: 200, maxHeight: 160, borderRadius: 6, display: "block" }} />
                            ) : (
                              <MarkdownText text={m.content ?? ""} />
                            )}
                            <div className="msg-time">
                              {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={bottomRef} />
                </div>

                {/* Pickers overlay */}
                <AnimatePresence>
                  {(showEmoji || showGif) && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.12 }}
                      style={{ position: "absolute", bottom: 52, left: 0, right: 0, zIndex: 10, background: "var(--bg-elevated)", borderTop: "1px solid var(--border)" }}
                    >
                      {showEmoji && <EmojiPicker onEmoji={(em) => { insertAtCursor(em); setShowEmoji(false); }} />}
                      {showGif   && <GifPicker   onGif={(url) => { sendMessage(url); setShowGif(false); }} />}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Compose bar */}
                <div style={{ padding: "8px 10px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                  <button className="btn btn-ghost btn-icon"
                    onClick={(e) => { e.stopPropagation(); setShowGif(false); setShowEmoji((v) => !v); }}
                    style={{ flexShrink: 0, opacity: showEmoji ? 1 : 0.55, color: showEmoji ? "var(--accent)" : undefined }} title="Emoji">
                    <SmilePlus size={15} />
                  </button>
                  <button className="btn btn-ghost btn-icon"
                    onClick={(e) => { e.stopPropagation(); setShowEmoji(false); setShowGif((v) => !v); }}
                    style={{ flexShrink: 0, opacity: showGif ? 1 : 0.55, color: showGif ? "var(--accent)" : undefined }} title="GIF">
                    <Film size={15} />
                  </button>
                  <input
                    ref={inputRef}
                    className="input"
                    placeholder={t.friendsMessagePlaceholder}
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    style={{ flex: 1, height: 32, fontSize: 12 }}
                  />
                  <button className="btn btn-primary btn-icon" onClick={() => sendMessage()} disabled={!messageInput.trim()}
                    style={{ height: 32, width: 32, flexShrink: 0 }}>
                    <Send size={13} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* ---- GROUP CHAT VIEW ---- */}
            {view === "group-chat" && activeGroup && (
              <motion.div key="group-chat"
                initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.13 }}
                style={{ display: "flex", flexDirection: "column", height: "100%" }}
              >
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
                  <button className="btn btn-ghost btn-icon" onClick={() => { setView("list"); setTab("groups"); setAddingMember(false); }} style={{ opacity: 0.65 }}>
                    <ArrowLeft size={13} />
                  </button>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--accent-dim)", border: "1.5px solid var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Hash size={12} style={{ color: "var(--accent)" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {activeGroup.name}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                      {activeGroup.member_count} membre{activeGroup.member_count > 1 ? "s" : ""}
                    </div>
                  </div>
                  {/* Delete group (owner) or Leave group (member) */}
                  {activeGroup.created_by === myId ? (
                    <button className="btn btn-ghost btn-icon" title="Supprimer le groupe"
                      onClick={() => showConfirm(
                        `Supprimer le groupe « ${activeGroup.name} » ?`,
                        async () => {
                          await apiFetch(`/api/groups/${activeGroup.id}`, { method: "DELETE" });
                          setView("list"); setTab("groups"); setActiveGroup(null); loadData();
                        }
                      )}
                      style={{ opacity: 0.45, color: "var(--color-danger)" }}>
                      <Trash2 size={12} />
                    </button>
                  ) : (
                    <button className="btn btn-ghost btn-icon" title="Quitter le groupe"
                      onClick={() => showConfirm(
                        `Quitter le groupe « ${activeGroup.name} » ?`,
                        async () => {
                          await apiFetch(`/api/groups/${activeGroup.id}/members/${myId}`, { method: "DELETE" });
                          setView("list"); setTab("groups"); setActiveGroup(null); loadData();
                        }
                      )}
                      style={{ opacity: 0.45, color: "var(--color-danger)" }}>
                      <LogOut size={12} />
                    </button>
                  )}
                  {/* Add member button — only for owner/admin */}
                  {activeGroup.created_by === myId && (
                    <button className="btn btn-ghost btn-icon" title="Ajouter un ami"
                      onClick={() => addingMember ? setAddingMember(false) : openAddMember()}
                      style={{ opacity: addingMember ? 1 : 0.55, color: addingMember ? "var(--accent)" : undefined }}>
                      <UserPlus size={13} />
                    </button>
                  )}
                  {/* Group voice call button */}
                  <button
                    className="btn btn-ghost btn-icon"
                    title="Appel vocal de groupe"
                    onClick={() => {
                      const memberIds = groupMembers.map((m) => m.user_id);
                      window.dispatchEvent(new CustomEvent("voice:call", {
                        detail: { type: "group", groupId: activeGroup.id, groupName: activeGroup.name, memberIds }
                      }));
                    }}
                    style={{ opacity: 0.6 }}
                  >
                    <Phone size={13} />
                  </button>
                  <button className="btn btn-ghost btn-icon" onClick={onClose} style={{ opacity: 0.5 }}>
                    <X size={13} />
                  </button>
                </div>

                {/* Add member panel (slide-down) */}
                <AnimatePresence>
                  {addingMember && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      style={{ overflow: "hidden", flexShrink: 0, borderBottom: "1px solid var(--border)" }}
                    >
                      <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 4, maxHeight: 160, overflowY: "auto" }}>
                        {friends.filter((f) => !groupMembers.some((m) => m.user_id === f.friend_id)).length === 0 ? (
                          <span style={{ fontSize: 11, color: "var(--text-muted)", padding: "4px 0" }}>Tous vos amis sont déjà dans le groupe</span>
                        ) : friends.filter((f) => !groupMembers.some((m) => m.user_id === f.friend_id)).map((f) => {
                          const st = addMemberStatus[f.friend_id];
                          return (
                            <div key={f.friend_id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <FriendAvatar name={f.display_name || f.username} size={22} userId={f.friend_id} />
                              <span style={{ flex: 1, fontSize: 12, color: "var(--text-primary)" }}>{f.display_name || f.username}</span>
                              <button
                                className="btn btn-ghost btn-icon"
                                style={{ height: 24, width: 24, opacity: st === "ok" ? 0.5 : 1, color: st === "ok" ? "var(--color-success)" : st === "error" ? "var(--color-danger)" : "var(--accent)" }}
                                disabled={st === "loading" || st === "ok"}
                                onClick={() => addMemberToGroup(f.friend_id)}
                              >
                                {st === "ok" ? <Check size={12} /> : st === "loading" ? <span style={{ fontSize: 10 }}>…</span> : <UserCheck size={12} />}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Messages */}
                <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                  {groupMsgLoading && groupMessages.length === 0 ? (
                    <div className="fp-empty"><span style={{ fontSize: 11, color: "var(--text-muted)" }}>...</span></div>
                  ) : groupMessages.length === 0 ? (
                    <div className="fp-empty"><span style={{ fontSize: 11, color: "var(--text-muted)" }}>Soyez le premier à écrire !</span></div>
                  ) : (
                    groupMessages.map((m) => {
                      const fromMe = m.sender_id === myId || m.username === "me";
                      return (
                        <div key={m.id} style={{ display: "flex", justifyContent: fromMe ? "flex-end" : "flex-start" }}>
                          {!fromMe && (
                            <div style={{ marginRight: 6, flexShrink: 0, alignSelf: "flex-end" }}>
                              <FriendAvatar name={m.display_name || m.username} size={22} userId={m.sender_id} />
                            </div>
                          )}
                          <div style={{ maxWidth: "75%" }}>
                            {!fromMe && (
                              <div style={{ fontSize: 9, color: "var(--text-muted)", marginBottom: 2, paddingLeft: 2 }}>
                                {m.display_name || m.username}
                              </div>
                            )}
                            <div className={`msg-bubble ${fromMe ? "msg-mine" : "msg-theirs"}`}>
                              {m.gif_url ? (
                                <img src={m.gif_url} alt="GIF" style={{ maxWidth: 200, maxHeight: 160, borderRadius: 6, display: "block" }} />
                              ) : (
                                <MarkdownText text={m.content ?? ""} />
                              )}
                              <div className="msg-time">
                                {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={bottomRef} />
                </div>

                {/* Pickers overlay */}
                <AnimatePresence>
                  {(showEmoji || showGif) && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.12 }}
                      style={{ position: "absolute", bottom: 52, left: 0, right: 0, zIndex: 10, background: "var(--bg-elevated)", borderTop: "1px solid var(--border)" }}
                    >
                      {showEmoji && <EmojiPicker onEmoji={(em) => { insertAtCursor(em); setGroupMsgInput((p) => p + em); setShowEmoji(false); }} />}
                      {showGif   && <GifPicker   onGif={(url) => { sendGroupMessage(url); setShowGif(false); }} />}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Compose bar */}
                <div style={{ padding: "8px 10px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                  <button className="btn btn-ghost btn-icon"
                    onClick={(e) => { e.stopPropagation(); setShowGif(false); setShowEmoji((v) => !v); }}
                    style={{ flexShrink: 0, opacity: showEmoji ? 1 : 0.55, color: showEmoji ? "var(--accent)" : undefined }}>
                    <SmilePlus size={15} />
                  </button>
                  <button className="btn btn-ghost btn-icon"
                    onClick={(e) => { e.stopPropagation(); setShowEmoji(false); setShowGif((v) => !v); }}
                    style={{ flexShrink: 0, opacity: showGif ? 1 : 0.55, color: showGif ? "var(--accent)" : undefined }}>
                    <Film size={15} />
                  </button>
                  <input
                    className="input"
                    placeholder={t.friendsMessagePlaceholder}
                    value={groupMsgInput}
                    onChange={(e) => setGroupMsgInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendGroupMessage(); } }}
                    style={{ flex: 1, height: 32, fontSize: 12 }}
                  />
                  <button className="btn btn-primary btn-icon" onClick={() => sendGroupMessage()} disabled={!groupMsgInput.trim()}
                    style={{ height: 32, width: 32, flexShrink: 0 }}>
                    <Send size={13} />
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>

    {/* ── Confirm dialog ────────────────────────────── */}
    <AnimatePresence>
      {confirmDialog && (
        <motion.div
          className="modal-overlay"
          style={{ zIndex: 200 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={() => setConfirmDialog(null)}
        >
          <motion.div
            className="modal"
            style={{ width: 320, padding: "20px 22px" }}
            initial={{ opacity: 0, scale: 0.93, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: -10 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ fontSize: 13.5, color: "var(--text-primary)", lineHeight: 1.55 }}>
              {confirmDialog.message}
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
              <button
                className="btn btn-ghost"
                style={{ height: 30, fontSize: 12, padding: "0 14px" }}
                onClick={() => setConfirmDialog(null)}
              >
                Annuler
              </button>
              <button
                className="btn"
                style={{
                  height: 30, fontSize: 12, padding: "0 14px",
                  background: "var(--color-danger)", color: "#fff",
                  border: "1px solid var(--color-danger)",
                }}
                onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}
              >
                Confirmer
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}
