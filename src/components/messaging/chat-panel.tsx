"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { MessageSquare, X, ArrowLeft, Send, Settings, Plus, Trash2, VolumeX, Volume2, UserPlus } from "lucide-react";

interface AuthInfo {
  userId: string;
  role: string;
  tenantId: string | null;
}

interface Msg {
  id: string;
  senderId: string;
  senderName: string;
  groupId: string | null;
  recipientId: string | null;
  content: string;
  createdAt: string;
}

interface Group {
  id: string;
  name: string;
  createdBy: string;
  memberCount?: number;
}

interface GroupMember {
  userId: string;
  fullName: string;
  role: string;
  muted: boolean;
}

interface TenantUser {
  id: string;
  fullName: string;
  role: string;
}

type View =
  | { type: "groups" }
  | { type: "groupChat"; group: Group }
  | { type: "groupManage"; group: Group }
  | { type: "dm-list" }
  | { type: "dm"; user: TenantUser };

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-purple-500",
  admin: "bg-blue-500",
  quality_tech: "bg-green-500",
  engineer: "bg-yellow-500",
  shipping: "bg-orange-500",
  worker: "bg-gray-500",
};

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return formatTime(iso);
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function ChatPanel() {
  const [auth, setAuth] = useState<AuthInfo | null | undefined>(undefined); // undefined = loading
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"groups" | "direct">("groups");
  const [view, setView] = useState<View>({ type: "groups" });

  const [groups, setGroups] = useState<Group[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [allTenantUsers, setAllTenantUsers] = useState<TenantUser[]>([]);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastMsgTimestamp = useRef<string>("");

  const isAdmin = auth?.role === "admin" || auth?.role === "owner";

  // ── Auth check ──────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/auth")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || !data.userId || data.role === "super_admin" || !data.tenantId) {
          setAuth(null);
        } else {
          setAuth({ userId: data.userId, role: data.role, tenantId: data.tenantId });
        }
      })
      .catch(() => setAuth(null));
  }, []);

  // ── Load groups + users on auth ──────────────────────────────
  useEffect(() => {
    if (!auth) return;
    loadGroups();
    loadUsers();
  }, [auth]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadGroups = useCallback(async () => {
    const r = await fetch("/api/messages/groups");
    if (r.ok) setGroups(await r.json());
  }, []);

  const loadUsers = useCallback(async () => {
    const r = await fetch("/api/messages/users");
    if (r.ok) setUsers(await r.json());
  }, []);

  // ── Load messages for current view ──────────────────────────
  const fetchMessages = useCallback(
    async (replace = false) => {
      if (!auth) return;
      let url = "";

      if (view.type === "groupChat") {
        const after = replace ? "" : lastMsgTimestamp.current;
        url = `/api/messages?type=group&groupId=${view.group.id}${after ? `&after=${encodeURIComponent(after)}` : ""}`;
      } else if (view.type === "dm") {
        const after = replace ? "" : lastMsgTimestamp.current;
        url = `/api/messages?type=dm&with=${view.user.id}${after ? `&after=${encodeURIComponent(after)}` : ""}`;
      } else {
        return;
      }

      const r = await fetch(url);
      if (!r.ok) return;
      const data: Msg[] = await r.json();

      if (data.length > 0) {
        const last = data[data.length - 1].createdAt;
        lastMsgTimestamp.current = last;
        if (replace) {
          setMessages(data);
        } else {
          setMessages((prev) => {
            const ids = new Set(prev.map((m) => m.id));
            const newMsgs = data.filter((m) => !ids.has(m.id));
            return newMsgs.length > 0 ? [...prev, ...newMsgs] : prev;
          });
        }
      } else if (replace) {
        setMessages([]);
      }
    },
    [auth, view]
  );

  // ── When view changes, reload messages ────────────────────────
  useEffect(() => {
    lastMsgTimestamp.current = "";
    setMessages([]);
    fetchMessages(true);
  }, [view.type, (view as { group?: { id: string } }).group?.id, (view as { user?: { id: string } }).user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Polling ─────────────────────────────────────────────────
  useEffect(() => {
    if (!auth) return;
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    const interval = open ? 4000 : 30000;
    pollTimerRef.current = setInterval(() => {
      if (open && (view.type === "groupChat" || view.type === "dm")) {
        fetchMessages(false);
      } else if (!open) {
        checkUnread();
      }
    }, interval);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [auth, open, view, fetchMessages]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-scroll ─────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Mark read ────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    if (messages.length === 0) return;
    const last = messages[messages.length - 1].createdAt;
    if (view.type === "groupChat") {
      localStorage.setItem(`lastRead_group_${view.group.id}`, last);
    } else if (view.type === "dm" && auth) {
      const key = [auth.userId, view.user.id].sort().join("_");
      localStorage.setItem(`lastRead_dm_${key}`, last);
    }
    setUnreadCount(0);
  }, [messages, open, view, auth]);

  const checkUnread = useCallback(async () => {
    if (!auth) return;
    let count = 0;

    // Check groups
    for (const g of groups) {
      const stored = localStorage.getItem(`lastRead_group_${g.id}`) ?? "";
      const r = await fetch(`/api/messages?type=group&groupId=${g.id}${stored ? `&after=${encodeURIComponent(stored)}` : ""}`);
      if (r.ok) {
        const msgs: Msg[] = await r.json();
        count += msgs.filter((m) => m.senderId !== auth.userId).length;
      }
    }

    // Check DMs
    for (const u of users) {
      const key = [auth.userId, u.id].sort().join("_");
      const stored = localStorage.getItem(`lastRead_dm_${key}`) ?? "";
      const r = await fetch(`/api/messages?type=dm&with=${u.id}${stored ? `&after=${encodeURIComponent(stored)}` : ""}`);
      if (r.ok) {
        const msgs: Msg[] = await r.json();
        count += msgs.filter((m) => m.senderId !== auth.userId).length;
      }
    }

    setUnreadCount(count);
  }, [auth, groups, users]);

  // ── Load group members for manage view ───────────────────────
  useEffect(() => {
    if (view.type !== "groupManage") return;
    fetch(`/api/messages/groups/${view.group.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.members) setMembers(data.members);
      });
    if (isAdmin) {
      fetch("/api/messages/users")
        .then((r) => r.json())
        .then(setAllTenantUsers);
    }
  }, [view, isAdmin]);

  // ── Send message ─────────────────────────────────────────────
  const sendMessage = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    const body: Record<string, string> = { content: input.trim() };
    if (view.type === "groupChat") body.groupId = view.group.id;
    else if (view.type === "dm") body.recipientId = view.user.id;
    else { setSending(false); return; }

    const r = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (r.ok) {
      const msg: Msg = await r.json();
      setMessages((prev) => [...prev, msg]);
      lastMsgTimestamp.current = msg.createdAt;
      setInput("");
    }
    setSending(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── Group management ─────────────────────────────────────────
  const toggleMute = async (group: Group, userId: string, currentlyMuted: boolean) => {
    await fetch(`/api/messages/groups/${group.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "setMuted", userId, muted: !currentlyMuted }),
    });
    setMembers((prev) => prev.map((m) => (m.userId === userId ? { ...m, muted: !currentlyMuted } : m)));
  };

  const removeMember = async (group: Group, userId: string) => {
    await fetch(`/api/messages/groups/${group.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "removeMember", userId }),
    });
    setMembers((prev) => prev.filter((m) => m.userId !== userId));
  };

  const addMember = async (group: Group, userId: string) => {
    await fetch(`/api/messages/groups/${group.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "addMember", userId }),
    });
    const u = allTenantUsers.find((u) => u.id === userId);
    if (u) setMembers((prev) => [...prev, { userId: u.id, fullName: u.fullName, role: u.role, muted: false }]);
  };

  const [newGroupName, setNewGroupName] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [selectedNewMembers, setSelectedNewMembers] = useState<string[]>([]);

  const createGroup = async () => {
    if (!newGroupName.trim() || creatingGroup) return;
    setCreatingGroup(true);
    const r = await fetch("/api/messages/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newGroupName.trim(), memberIds: selectedNewMembers }),
    });
    if (r.ok) {
      const group = await r.json();
      setGroups((prev) => [...prev, group]);
      setNewGroupName("");
      setSelectedNewMembers([]);
      setShowCreateGroup(false);
    }
    setCreatingGroup(false);
  };

  // ── Don't render if not authed ───────────────────────────────
  if (auth === undefined) return null; // still loading
  if (auth === null) return null; // not authed / super_admin

  // ── Render ───────────────────────────────────────────────────
  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors"
        aria-label="Toggle messages"
      >
        <MessageSquare className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-destructive text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed right-0 top-0 h-screen w-80 z-40 flex flex-col bg-background border-l border-border shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
            <span className="font-semibold text-sm">Messages</span>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground p-1 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tabs */}
          {view.type === "groups" || view.type === "dm-list" ? (
            <div className="flex border-b border-border">
              <button
                onClick={() => { setTab("groups"); setView({ type: "groups" }); }}
                className={`flex-1 py-2 text-xs font-medium transition-colors ${tab === "groups" ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                Groups
              </button>
              <button
                onClick={() => { setTab("direct"); setView({ type: "dm-list" }); }}
                className={`flex-1 py-2 text-xs font-medium transition-colors ${tab === "direct" ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                Direct
              </button>
            </div>
          ) : (
            /* Sub-view header with back button */
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/20">
              <button
                onClick={() => {
                  if (view.type === "groupChat" || view.type === "groupManage") setView({ type: "groups" });
                  else if (view.type === "dm") setView({ type: "dm-list" });
                }}
                className="text-muted-foreground hover:text-foreground p-1 rounded"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium truncate flex-1">
                {view.type === "groupChat" ? view.group.name
                  : view.type === "groupManage" ? `Manage: ${view.group.name}`
                  : view.type === "dm" ? view.user.fullName
                  : ""}
              </span>
              {view.type === "groupChat" && isAdmin && (
                <button
                  onClick={() => setView({ type: "groupManage", group: (view as { group: Group }).group })}
                  className="text-muted-foreground hover:text-foreground p-1 rounded"
                >
                  <Settings className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* Content area */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* ── Groups list ── */}
            {view.type === "groups" && (
              <div className="flex-1 overflow-y-auto">
                {isAdmin && (
                  <div className="p-3 border-b border-border">
                    {!showCreateGroup ? (
                      <button
                        onClick={() => setShowCreateGroup(true)}
                        className="w-full flex items-center gap-2 text-xs text-primary hover:text-primary/80 py-1"
                      >
                        <Plus className="w-3 h-3" /> Create group
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <input
                          autoFocus
                          value={newGroupName}
                          onChange={(e) => setNewGroupName(e.target.value)}
                          placeholder="Group name..."
                          className="w-full text-xs border border-border rounded px-2 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                          onKeyDown={(e) => e.key === "Enter" && createGroup()}
                        />
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {users.map((u) => (
                            <label key={u.id} className="flex items-center gap-2 text-xs cursor-pointer py-0.5">
                              <input
                                type="checkbox"
                                checked={selectedNewMembers.includes(u.id)}
                                onChange={(e) =>
                                  setSelectedNewMembers((prev) =>
                                    e.target.checked ? [...prev, u.id] : prev.filter((id) => id !== u.id)
                                  )
                                }
                                className="rounded"
                              />
                              <span>{u.fullName}</span>
                            </label>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={createGroup}
                            disabled={creatingGroup || !newGroupName.trim()}
                            className="flex-1 text-xs bg-primary text-primary-foreground rounded px-2 py-1 hover:bg-primary/90 disabled:opacity-50"
                          >
                            Create
                          </button>
                          <button
                            onClick={() => { setShowCreateGroup(false); setNewGroupName(""); setSelectedNewMembers([]); }}
                            className="flex-1 text-xs border border-border rounded px-2 py-1 hover:bg-muted"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {groups.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">No groups yet</p>
                ) : (
                  groups.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => setView({ type: "groupChat", group: g })}
                      className="w-full text-left px-4 py-3 hover:bg-muted/50 border-b border-border/50 flex items-center gap-3"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                        {initials(g.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{g.name}</p>
                        {g.memberCount !== undefined && (
                          <p className="text-xs text-muted-foreground">{g.memberCount} members</p>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* ── DM user list ── */}
            {view.type === "dm-list" && (
              <div className="flex-1 overflow-y-auto">
                {users.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">No teammates found</p>
                ) : (
                  users.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => setView({ type: "dm", user: u })}
                      className="w-full text-left px-4 py-3 hover:bg-muted/50 border-b border-border/50 flex items-center gap-3"
                    >
                      <div className={`w-8 h-8 rounded-full ${ROLE_COLORS[u.role] ?? "bg-gray-500"} text-white flex items-center justify-center text-xs font-bold shrink-0`}>
                        {initials(u.fullName)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{u.fullName}</p>
                        <p className="text-xs text-muted-foreground capitalize">{u.role.replace("_", " ")}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* ── Message thread (group or DM) ── */}
            {(view.type === "groupChat" || view.type === "dm") && (
              <>
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {messages.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-6">No messages yet. Say hello!</p>
                  )}
                  {messages.map((msg) => {
                    const isOwn = msg.senderId === auth.userId;
                    return (
                      <div key={msg.id} className={`flex gap-2 ${isOwn ? "flex-row-reverse" : ""}`}>
                        {!isOwn && (
                          <div className={`w-7 h-7 rounded-full ${ROLE_COLORS["worker"]} text-white flex items-center justify-center text-xs font-bold shrink-0 mt-1`}>
                            {initials(msg.senderName)}
                          </div>
                        )}
                        <div className={`max-w-[75%] ${isOwn ? "items-end" : "items-start"} flex flex-col`}>
                          {!isOwn && (
                            <span className="text-xs text-muted-foreground mb-0.5">{msg.senderName}</span>
                          )}
                          <div className={`rounded-2xl px-3 py-1.5 text-sm ${isOwn ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted rounded-tl-sm"}`}>
                            {msg.content}
                          </div>
                          <span className="text-xs text-muted-foreground mt-0.5">{formatDate(msg.createdAt)}</span>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
                <div className="p-2 border-t border-border flex gap-2 items-end">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Message..."
                    rows={1}
                    className="flex-1 text-sm border border-border rounded-lg px-3 py-2 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring max-h-24"
                    style={{ minHeight: "36px" }}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!input.trim() || sending}
                    className="w-9 h-9 bg-primary text-primary-foreground rounded-lg flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}

            {/* ── Group manage view ── */}
            {view.type === "groupManage" && (
              <div className="flex-1 overflow-y-auto p-3 space-y-4">
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Members ({members.length})</h3>
                  {members.map((m) => (
                    <div key={m.userId} className="flex items-center gap-2 py-1.5">
                      <div className={`w-7 h-7 rounded-full ${ROLE_COLORS[m.role] ?? "bg-gray-500"} text-white flex items-center justify-center text-xs font-bold shrink-0`}>
                        {initials(m.fullName)}
                      </div>
                      <span className="text-sm flex-1 truncate">{m.fullName}</span>
                      <button
                        onClick={() => toggleMute((view as { group: Group }).group, m.userId, m.muted)}
                        className={`p-1 rounded hover:bg-muted ${m.muted ? "text-destructive" : "text-muted-foreground"}`}
                        title={m.muted ? "Unmute" : "Mute"}
                      >
                        {m.muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => removeMember((view as { group: Group }).group, m.userId)}
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add members */}
                {allTenantUsers.filter((u) => !members.find((m) => m.userId === u.id)).length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Add Members</h3>
                    {allTenantUsers
                      .filter((u) => !members.find((m) => m.userId === u.id))
                      .map((u) => (
                        <div key={u.id} className="flex items-center gap-2 py-1.5">
                          <div className={`w-7 h-7 rounded-full ${ROLE_COLORS[u.role] ?? "bg-gray-500"} text-white flex items-center justify-center text-xs font-bold shrink-0`}>
                            {initials(u.fullName)}
                          </div>
                          <span className="text-sm flex-1 truncate">{u.fullName}</span>
                          <button
                            onClick={() => addMember((view as { group: Group }).group, u.id)}
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-primary"
                            title="Add to group"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                  </div>
                )}

                {/* Delete group */}
                <div className="pt-2 border-t border-border">
                  <button
                    onClick={async () => {
                      if (!confirm(`Delete group "${(view as { group: Group }).group.name}"? This cannot be undone.`)) return;
                      const r = await fetch(`/api/messages/groups/${(view as { group: Group }).group.id}`, { method: "DELETE" });
                      if (r.ok) {
                        setGroups((prev) => prev.filter((g) => g.id !== (view as { group: Group }).group.id));
                        setView({ type: "groups" });
                      }
                    }}
                    className="w-full text-xs text-destructive border border-destructive/30 rounded px-3 py-1.5 hover:bg-destructive/10 flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-3 h-3" /> Delete group
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
