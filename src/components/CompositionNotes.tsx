"use client";

import { useEffect, useState, useCallback } from "react";
import useWebSocket from "@/hooks/useWebSocket";

// ─── Types ───

interface NoteUser {
  id: number;
  summonerName: string;
  tag: string;
}

interface Note {
  id: number;
  compositionId: number;
  userId: number;
  content: string;
  tags: string; // JSON string of string[]
  createdAt: string;
  updatedAt: string;
  user: NoteUser;
}

interface Props {
  compositionId: number;
}

// ─── Tag categories ───

const GOOD_TAGS = new Set(["#bueno", "#chido"]);
const BAD_TAGS = new Set(["#malo", "#no"]);
const SUGGESTION_TAGS = new Set(["#probar", "#mejorar"]);

function getTagColor(tag: string): string {
  if (GOOD_TAGS.has(tag))
    return "bg-green-500/20 text-green-400 border-green-500/40";
  if (BAD_TAGS.has(tag))
    return "bg-red-500/20 text-red-400 border-red-500/40";
  if (SUGGESTION_TAGS.has(tag))
    return "bg-cyan-500/20 text-cyan-400 border-cyan-500/40";
  return "bg-purple-500/20 text-purple-400 border-purple-500/40";
}

function parseTags(tagsStr: string): string[] {
  try {
    const parsed = JSON.parse(tagsStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ─── Relative time ───

function formatRelativeTime(iso: string): string {
  const now = new Date();
  const d = new Date(iso);
  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "ahora";
  if (diffMin < 60) return `hace ${diffMin} min`;
  if (diffHour < 24) return `hace ${diffHour} hora${diffHour > 1 ? "s" : ""}`;
  if (diffDay === 1) return "ayer";
  if (diffDay < 7) return `hace ${diffDay} días`;
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

// ─── Helper to get auth headers ───

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("lolteam_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// ─── Component ───

export default function CompositionNotes({ compositionId }: Props) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [pendingTags, setPendingTags] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const { addListener } = useWebSocket();

  // ── Auth headers ──
  const getAuthHeaders = useCallback((): Record<string, string> => {
    const token = localStorage.getItem("lolteam_token");
    return { Authorization: "Bearer " + token };
  }, []);

  // ── Get current user ──
  const currentUser = (() => {
    try {
      const raw = localStorage.getItem("lolteam_user");
      return raw ? (JSON.parse(raw) as { id?: number }) : null;
    } catch {
      return null;
    }
  })();

  // ── Fetch existing notes ──
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const token = localStorage.getItem("lolteam_token");
      if (!token) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const res = await fetch(
          `/api/compositions/${compositionId}/notes`,
          { headers: getAuthHeaders() }
        );
        const data = await res.json();
        if (!cancelled) {
          if (res.ok) setNotes(data.notes ?? []);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [compositionId]);

  // ── WebSocket: refetch on data_changed ──
  useEffect(() => {
    const unsub = addListener((msg) => {
      if (msg.type === "data_changed" && msg.entity === "notes") {
        const token = localStorage.getItem("lolteam_token");
        if (!token) return;
        fetch(`/api/compositions/${compositionId}/notes`, {
          headers: { Authorization: "Bearer " + token },
        }).then(r => r.json()).then(d => {
          if (d.notes) setNotes(d.notes);
        }).catch(() => {});
      }
    });
    return () => { unsub(); };
  }, [compositionId, addListener]);

  // ── Tag input: add tag on space / enter / comma ──
  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === " " || e.key === "Enter" || e.key === ",") {
      const val = tagInput.trim();
      if (val.startsWith("#") && val.length > 1) {
        e.preventDefault();
        if (!pendingTags.includes(val)) {
          setPendingTags([...pendingTags, val]);
        }
        setTagInput("");
      }
    }
    // Also handle Backspace on empty input to remove last tag
    if (e.key === "Backspace" && tagInput === "" && pendingTags.length > 0) {
      setPendingTags(pendingTags.slice(0, -1));
    }
  };

  const removePendingTag = (tag: string) => {
    setPendingTags(pendingTags.filter((t) => t !== tag));
  };

  // ── Remove tag from an existing note (optimistic + PATCH) ──
  const handleRemoveTagFromNote = async (note: Note, tagToRemove: string) => {
    const currentTags = parseTags(note.tags);
    const updatedTags = currentTags.filter((t) => t !== tagToRemove);

    // Optimistic update
    setNotes((prev) =>
      prev.map((n) =>
        n.id === note.id
          ? { ...n, tags: JSON.stringify(updatedTags) }
          : n
      )
    );

    // Try to persist — endpoint returns 404 if not implemented yet
    try {
      await fetch(`/api/compositions/${compositionId}/notes?noteId=${note.id}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ tags: updatedTags }),
      });
    } catch {
      // Failed — component stays optimistic; page refresh shows original
    }
  };

  // ── Delete a note (author only) ──
  const handleDeleteNote = async (noteId: number) => {
    if (deletingId) return;
    setDeletingId(noteId);

    try {
      const res = await fetch(
        `/api/compositions/${compositionId}/notes?noteId=${noteId}`,
        { method: "DELETE", headers: getAuthHeaders() }
      );
      if (res.ok) {
        setNotes((prev) => prev.filter((n) => n.id !== noteId));
      }
    } catch {
      // ignore
    } finally {
      setDeletingId(null);
    }
  };

  // ── Send new note ──
  const handleSend = async () => {
    const trimmed = content.trim();
    if (!trimmed || sending) return;

    setSending(true);
    try {
      const res = await fetch(`/api/compositions/${compositionId}/notes`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ content: trimmed, tags: pendingTags }),
      });
      const data = await res.json();
      if (res.ok && data.note) {
        setNotes((prev) => [data.note, ...prev]);
        setContent("");
        setPendingTags([]);
        setTagInput("");
      }
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  };

  // ── Loading state ──
  if (loading) {
    return (
      <div className="lol-card flex flex-col h-full">
        {/* Header shimmer */}
        <div className="flex items-center justify-between p-3 border-b border-[var(--ocaso-card-border)]">
          <span className="text-xs text-[var(--ocaso-text-muted)] font-semibold uppercase tracking-wider">
            Notas
          </span>
        </div>
        {/* Card shimmers */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3 scroll-smooth">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="border border-[var(--ocaso-card-border)] rounded-xl p-3 space-y-2 animate-fade-in"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="flex items-center gap-2">
                <div className="loading-shimmer h-3 w-20" />
                <div className="loading-shimmer h-2 w-12" />
              </div>
              <div className="loading-shimmer h-3 w-full" />
              <div className="loading-shimmer h-3 w-3/4" />
              <div className="flex gap-1.5 mt-2">
                <div className="loading-shimmer h-4 w-12 rounded-full" />
                <div className="loading-shimmer h-4 w-16 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="lol-card flex flex-col h-full overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--ocaso-card-border)] shrink-0">
        <span className="text-xs text-[var(--ocaso-text-muted)] font-semibold uppercase tracking-wider">
          Notas
        </span>
        <span className="text-[9px] text-[var(--ocaso-text-muted)]">
          {notes.length} nota{notes.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Notes list ── */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3 scroll-smooth">
        {notes.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-[var(--ocaso-text-muted)] mb-2 opacity-40"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            <p className="text-[11px] text-[var(--ocaso-text-muted)] italic">
              Sin notas aún. Agrega la primera.
            </p>
          </div>
        )}

        {notes.map((note) => {
          const isAuthor = currentUser?.id === note.userId;
          const noteTags = parseTags(note.tags);

          return (
            <div
              key={note.id}
              className="border border-[var(--ocaso-card-border)] rounded-xl p-3 space-y-1.5 animate-fade-in relative group"
            >
              {/* ── Author row ── */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  {/* Avatar circle */}
                  <div className="w-4 h-4 rounded-full bg-[var(--ocaso-purple)]/20 border border-[var(--ocaso-purple)]/30 flex items-center justify-center shrink-0">
                    <span className="text-[7px] font-semibold text-[var(--ocaso-purple-light)]">
                      {note.user.summonerName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-[10px] font-medium text-[var(--ocaso-purple-light)] truncate">
                    {note.user.summonerName}
                  </span>
                  <span className="text-[8px] text-[var(--ocaso-cyan)] shrink-0">
                    #{note.user.tag}
                  </span>
                  <span className="text-[8px] text-[var(--ocaso-text-muted)] mx-0.5">
                    ·
                  </span>
                  <span className="text-[8px] text-[var(--ocaso-text-muted)] whitespace-nowrap">
                    {formatRelativeTime(note.createdAt)}
                  </span>
                </div>

                {/* ── Delete button (author only) ── */}
                {isAuthor && (
                  <button
                    onClick={() => handleDeleteNote(note.id)}
                    disabled={deletingId === note.id}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-[var(--ocaso-danger)]/10 text-[var(--ocaso-text-muted)] hover:text-[var(--ocaso-danger)] shrink-0"
                    title="Eliminar nota"
                  >
                    {deletingId === note.id ? (
                      <span className="inline-block w-3 h-3 border-2 border-[var(--ocaso-danger)]/30 border-t-[var(--ocaso-danger)] rounded-full animate-spin" />
                    ) : (
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    )}
                  </button>
                )}
              </div>

              {/* ── Content ── */}
              <p className="text-xs text-[var(--ocaso-text)] whitespace-pre-wrap break-words leading-relaxed">
                {note.content}
              </p>

              {/* ── Tags as badges ── */}
              {noteTags.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {noteTags.map((tag) => (
                    <span
                      key={tag}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium border ${getTagColor(tag)} ${
                        isAuthor ? "cursor-pointer" : ""
                      }`}
                      onClick={() => {
                        if (isAuthor) handleRemoveTagFromNote(note, tag);
                      }}
                      title={
                        isAuthor ? "Eliminar etiqueta" : undefined
                      }
                    >
                      {tag}
                      {isAuthor && (
                        <svg
                          width="8"
                          height="8"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          className="opacity-60 hover:opacity-100"
                        >
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Input area ── */}
      <div className="shrink-0 border-t border-[var(--ocaso-card-border)] p-3 space-y-2">
        {/* Textarea */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Escribe una nota..."
          rows={2}
          disabled={sending}
          className="input-ocaso w-full resize-none px-3 py-2 text-xs leading-relaxed placeholder:text-[var(--ocaso-text-muted)]/50"
        />

        {/* ── Tag input ── */}
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              placeholder="#etiqueta + espacio para agregar"
              disabled={sending}
              className="input-ocaso w-full px-3 py-1.5 text-[10px] placeholder:text-[var(--ocaso-text-muted)]/40"
            />
          </div>
        </div>

        {/* ── Pending tags chips ── */}
        {pendingTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {pendingTags.map((tag) => (
              <span
                key={tag}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium border cursor-pointer ${getTagColor(tag)}`}
                onClick={() => removePendingTag(tag)}
                title="Eliminar etiqueta"
              >
                {tag}
                <svg
                  width="8"
                  height="8"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  className="opacity-60 hover:opacity-100"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </span>
            ))}
          </div>
        )}

        {/* ── Submit button ── */}
        <div className="flex justify-end">
          <button
            onClick={handleSend}
            disabled={!content.trim() || sending}
            className="btn-ocaso px-4 py-1.5 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sending ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Enviando...
              </span>
            ) : (
              "Agregar Nota"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
