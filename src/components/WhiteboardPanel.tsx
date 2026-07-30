"use client";

import { Rnd } from "react-rnd";
import { useState, useEffect, useRef, useCallback } from "react";

// ─── Types ───
interface WhiteboardElement {
  id: string;
  type: "note" | "champion";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  lockedBy: number | null;
  content: Record<string, unknown>;
  owner?: { id: number; summonerName: string; tag: string } | null;
  locker?: { id: number; summonerName: string; tag: string } | null;
}

interface Champion {
  id: number;
  championId: number;
  name: string;
  imageUrl: string;
  tags: string;
}

interface Props {
  compositionId: number;
}

// ─── Helpers ───
function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("lolteam_token");
  return { Authorization: "Bearer " + token, "Content-Type": "application/json" };
}

// ─── SVG Icons (no emojis) ───
function IconNote() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function IconChampionAdd() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 L15 9 L22 9 L16 14 L18 21 L12 17 L6 21 L8 14 L2 9 L9 9 Z" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export default function WhiteboardPanel({ compositionId }: Props) {
  // ─── State ───
  const [elements, setElements] = useState<WhiteboardElement[]>([]);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<number | null>(null);
  const [showChampionPicker, setShowChampionPicker] = useState(false);
  const [champions, setChampions] = useState<Champion[]>([]);
  const [championSearch, setChampionSearch] = useState("");
  const [championsLoading, setChampionsLoading] = useState(false);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [loading, setLoading] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const dragThrottleRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // ─── Get user id from token ───
  useEffect(() => {
    const token = localStorage.getItem("lolteam_token");
    if (!token) return;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      setMyUserId(payload.userId);
    } catch {
      // ignore
    }
  }, []);

  // ─── Fetch whiteboard data ───
  const fetchWhiteboard = useCallback(async () => {
    try {
      const res = await fetch(`/api/compositions/${compositionId}/whiteboard`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return;
      const data = await res.json();
      setElements(data.whiteboard?.elements || []);
    } catch {
      console.error("Error fetching whiteboard");
    } finally {
      setLoading(false);
    }
  }, [compositionId]);

  // ─── Fetch champions ───
  const fetchChampions = useCallback(async () => {
    setChampionsLoading(true);
    try {
      const res = await fetch("/api/champions");
      const data = await res.json();
      setChampions(data.champions || []);
    } catch {
      console.error("Error fetching champions");
    } finally {
      setChampionsLoading(false);
    }
  }, []);

  // ─── WebSocket connection ───
  useEffect(() => {
    const token = localStorage.getItem("lolteam_token");
    if (!token) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname;
    const url = `${protocol}//${host}:3006`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "auth", token }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          case "auth_ok":
            // Subscribe to whiteboard room
            ws.send(JSON.stringify({
              type: "wb:subscribe",
              compositionId,
            }));
            break;

          case "wb:element_added":
            setElements((prev) => {
              if (prev.find((e) => e.id === msg.element.id)) return prev;
              return [...prev, msg.element as WhiteboardElement];
            });
            break;

          case "wb:element_moved":
            setElements((prev) =>
              prev.map((e) =>
                e.id === msg.elementId
                  ? { ...e, x: msg.x as number, y: msg.y as number }
                  : e
              )
            );
            break;

          case "wb:element_updated":
            setElements((prev) =>
              prev.map((e) =>
                e.id === (msg.element as Record<string, unknown>).id
                  ? { ...e, ...(msg.element as Record<string, unknown>) }
                  : e
              )
            );
            break;

          case "wb:element_removed":
            setElements((prev) => prev.filter((e) => e.id !== msg.elementId));
            break;

          case "wb:locked":
            setElements((prev) =>
              prev.map((e) =>
                e.id === msg.elementId
                  ? {
                      ...e,
                      lockedBy: (msg.lockedBy as number | null),
                      locker: msg.lockedBy
                        ? { id: msg.lockedBy as number, summonerName: (msg.userName as string) || "", tag: "" }
                        : null,
                    }
                  : e
              )
            );
            break;
        }
      } catch {
        // ignore
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "wb:unsubscribe", compositionId }));
      }
      ws.close();
    };
  }, [compositionId]);

  // ─── Initial load ───
  useEffect(() => {
    fetchWhiteboard();
    fetchChampions();
  }, [fetchWhiteboard, fetchChampions]);

  // ─── WS send helper ───
  const wsSend = useCallback((data: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  // ─── Lock element ───
  const lockElement = useCallback(async (elementId: string, lock: boolean) => {
    try {
      await fetch(`/api/compositions/${compositionId}/whiteboard/lock`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ elementId, lock }),
      });
    } catch {
      // ignore
    }
    if (lock) {
      wsSend({ type: "wb:lock", compositionId, elementId, lock: true });
    } else {
      wsSend({ type: "wb:unlock", compositionId, elementId });
    }
  }, [compositionId, wsSend]);

  // ─── Create a new note ───
  const addNote = useCallback(async () => {
    const centerX = 400 + Math.random() * 200;
    const centerY = 300 + Math.random() * 200;

    try {
      const res = await fetch(`/api/compositions/${compositionId}/whiteboard`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          type: "note",
          x: centerX,
          y: centerY,
          width: 200,
          height: 150,
          content: { text: "" },
        }),
      });
      if (!res.ok) return;
      const data = await res.json();

      setElements((prev) => [...prev, data.element as WhiteboardElement]);
      wsSend({
        type: "wb:add",
        compositionId,
        element: data.element,
        elementId: data.element.id,
      });
    } catch {
      console.error("Error creating note");
    }
  }, [compositionId, wsSend]);

  // ─── Add champion from picker ───
  const addChampion = useCallback(async (champ: Champion) => {
    const centerX = 400 + Math.random() * 200;
    const centerY = 300 + Math.random() * 200;

    try {
      const res = await fetch(`/api/compositions/${compositionId}/whiteboard`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          type: "champion",
          x: centerX,
          y: centerY,
          width: 80,
          height: 100,
          content: {
            championId: champ.id,
            championName: champ.name,
            imageUrl: champ.imageUrl,
          },
        }),
      });
      if (!res.ok) return;
      const data = await res.json();

      setElements((prev) => [...prev, data.element as WhiteboardElement]);
      wsSend({
        type: "wb:add",
        compositionId,
        element: data.element,
        elementId: data.element.id,
      });
      setShowChampionPicker(false);
    } catch {
      console.error("Error adding champion");
    }
  }, [compositionId, wsSend]);

  // ─── Delete element ───
  const deleteElement = useCallback(async () => {
    if (!selectedElement) return;

    try {
      await fetch(`/api/compositions/${compositionId}/whiteboard/${selectedElement}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      setElements((prev) => prev.filter((e) => e.id !== selectedElement));
      wsSend({
        type: "wb:remove",
        compositionId,
        elementId: selectedElement,
      });
      setSelectedElement(null);
    } catch {
      console.error("Error deleting element");
    }
  }, [compositionId, selectedElement, wsSend]);

  // ─── Update element position/size (after drag/resize) ───
  const updateElement = useCallback(async (
    elementId: string,
    data: Record<string, unknown>
  ) => {
    // Optimistic local update (WS broadcast excludes sender)
    setElements((prev) =>
      prev.map((e) => (e.id === elementId ? { ...e, ...data } : e))
    );
    try {
      const res = await fetch(`/api/compositions/${compositionId}/whiteboard/${elementId}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) return;
      const result = await res.json();
      wsSend({
        type: "wb:update",
        compositionId,
        element: result.element,
        elementId,
      });
    } catch {
      console.error("Error updating element");
    }
  }, [compositionId, wsSend]);

  // ─── Save note text ───
  const saveNoteText = useCallback(async (elementId: string) => {
    const element = elements.find((e) => e.id === elementId);
    if (!element) return;
    await updateElement(elementId, { content: { ...element.content, text: editText } });
    setEditingNote(null);
  }, [elements, updateElement, editText]);

  // ─── Handle element click (select + lock) ───
  const handleElementClick = useCallback(async (elementId: string) => {
    const element = elements.find((e) => e.id === elementId);
    if (!element) return;

    // If locked by another user, ignore
    if (element.lockedBy && element.lockedBy !== myUserId) return;

    setSelectedElement((prev) => {
      // Unlock previous selection
      if (prev && prev !== elementId) {
        lockElement(prev, false);
      }
      return elementId;
    });

    // Lock this element
    await lockElement(elementId, true);
  }, [elements, myUserId, lockElement]);

  // ─── Deselect on background click ───
  const handleBackgroundClick = useCallback(() => {
    if (selectedElement) {
      lockElement(selectedElement, false);
      setSelectedElement(null);
      setEditingNote(null);
    }
  }, [selectedElement, lockElement]);

  // ─── Filtered champions ───
  const filteredChamps = champions.filter((c) => {
    const q = championSearch.toLowerCase().trim();
    if (!q) return true;
    return c.name.toLowerCase().includes(q);
  });

  // ─── Loading state ───
  if (loading) {
    return (
      <div className="lol-card p-4 animate-pulse">
        <div className="h-8 bg-[var(--ocaso-card-border)] rounded w-1/3 mb-3" />
        <div className="h-64 bg-[var(--ocaso-card-border)] rounded" />
      </div>
    );
  }

  return (
    <div className="lol-card overflow-hidden animate-fade-in" style={{ position: "relative" }}>
      {/* ════════════════════════════════════════ */}
      {/* TOOLBAR                                    */}
      {/* ════════════════════════════════════════ */}
      <div className="flex items-center gap-1.5 p-2 border-b border-[var(--ocaso-card-border)] bg-[var(--ocaso-bg)]/50">
        <button
          onClick={addNote}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] font-medium bg-[var(--ocaso-bg)] border border-[var(--ocaso-card-border)] text-[var(--ocaso-cyan)] hover:border-[var(--ocaso-cyan)]/40 hover:bg-[var(--ocaso-cyan)]/5 transition-all"
        >
          <IconNote />
          Agregar Nota
        </button>

        <button
          onClick={() => { setShowChampionPicker(true); fetchChampions(); }}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] font-medium bg-[var(--ocaso-bg)] border border-[var(--ocaso-card-border)] text-[var(--ocaso-purple-light)] hover:border-[var(--ocaso-purple)]/40 hover:bg-[var(--ocaso-purple)]/5 transition-all"
        >
          <IconChampionAdd />
          Agregar Campeon
        </button>

        <div className="w-px h-5 bg-[var(--ocaso-card-border)] mx-1" />

        <button
          onClick={deleteElement}
          disabled={!selectedElement}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] font-medium transition-all ${
            selectedElement
              ? "bg-[var(--ocaso-bg)] border border-[var(--ocaso-danger)]/40 text-[var(--ocaso-danger)] hover:bg-[var(--ocaso-danger)]/10"
              : "bg-[var(--ocaso-bg)] border border-[var(--ocaso-card-border)] text-[var(--ocaso-text-muted)] opacity-40 cursor-not-allowed"
          }`}
        >
          <IconTrash />
          Eliminar
        </button>

        <div className="flex-1" />

      </div>

      {/* ════════════════════════════════════════ */}
      {/* CANVAS (static scrollable)               */}
      {/* ════════════════════════════════════════ */}
      <div style={{ height: 500, position: "relative", overflow: "auto", background: "var(--ocaso-bg)" }}>
        <div style={{ width: 4000, height: 3000, position: "relative", background: "transparent" }} onClick={handleBackgroundClick}>
          {elements.map((el) => {
            const isLockedByOther = el.lockedBy !== null && el.lockedBy !== myUserId;
            const isSelected = selectedElement === el.id;

            return (
              <Rnd
                key={el.id}
                size={{ width: el.width, height: el.height }}
                position={{ x: el.x, y: el.y }}
                onDrag={(_e, d) => {
                  if (dragThrottleRef.current[el.id]) {
                    clearTimeout(dragThrottleRef.current[el.id]);
                  }
                  dragThrottleRef.current[el.id] = setTimeout(() => {
                    wsSend({
                      type: "wb:move",
                      compositionId,
                      elementId: el.id,
                      x: d.x,
                      y: d.y,
                    });
                  }, 100);
                }}
                onDragStop={(_e, d) => {
                  if (dragThrottleRef.current[el.id]) {
                    clearTimeout(dragThrottleRef.current[el.id]);
                    delete dragThrottleRef.current[el.id];
                  }
                  setElements((prev) =>
                    prev.map((e) => (e.id === el.id ? { ...e, x: d.x, y: d.y } : e))
                  );
                  updateElement(el.id, { x: d.x, y: d.y });
                }}
                onResizeStop={(_e, _dir, ref, _delta, position) => {
                  const w = parseFloat(ref.style.width) || 200;
                  const h = parseFloat(ref.style.height) || 100;
                  setElements((prev) =>
                    prev.map((e) =>
                      e.id === el.id
                        ? { ...e, x: position.x, y: position.y, width: w, height: h }
                        : e
                    )
                  );
                  updateElement(el.id, {
                    x: position.x,
                    y: position.y,
                    width: w,
                    height: h,
                  });
                }}
                disableDragging={isLockedByOther}
                enableResizing={!isLockedByOther}
                onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleElementClick(el.id); }}
                bounds="parent"
                style={{
                  zIndex: el.zIndex,
                  transform: `rotate(${el.rotation}deg)`,
                  ...(isLockedByOther ? { cursor: "not-allowed" } : {}),
                }}
                className={`rounded-lg transition-shadow cursor-grab ${
                  isSelected ? "ring-2 ring-[var(--ocaso-purple)]" : ""
                } ${isLockedByOther ? "cursor-not-allowed" : ""}`}
              >
                {/* ── Note element ── */}
                {el.type === "note" && (
                  <div
                    className="w-full h-full rounded-lg p-3 flex flex-col"
                    style={{
                      background: "linear-gradient(135deg, #1a1a2e, #16213e)",
                      border: `1px solid ${isSelected ? "var(--ocaso-purple)" : "var(--ocaso-card-border)"}`,
                      boxShadow: isSelected ? "0 0 20px var(--ocaso-purple-glow)" : "0 2px 8px rgba(0,0,0,0.3)",
                    }}
                  >
                    {editingNote === el.id ? (
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onBlur={() => { saveNoteText(el.id); }}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            setEditingNote(null);
                          }
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            saveNoteText(el.id);
                          }
                        }}
                        className="flex-1 w-full bg-transparent text-[12px] text-[var(--ocaso-text)] resize-none outline-none border-none placeholder:text-[var(--ocaso-text-muted)]"
                        autoFocus
                        placeholder="Escribe una nota..."
                      />
                    ) : (
                      <div
                        className="flex-1 text-[12px] text-[var(--ocaso-text)] overflow-y-auto whitespace-pre-wrap cursor-pointer"
                        onClick={() => {
                          if (!isLockedByOther) {
                            setEditingNote(el.id);
                            setEditText((el.content?.text as string) || "");
                          }
                        }}
                      >
                        {(el.content?.text as string) || (
                          <span className="text-[var(--ocaso-text-muted)] italic">
                            Click para editar...
                          </span>
                        )}
                      </div>
                    )}

                    {/* Lock overlay */}
                    {isLockedByOther && el.locker && (
                      <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                        <div className="flex items-center gap-1.5 text-[10px] text-[var(--ocaso-cyan)]">
                          <IconLock />
                          Editando por {el.locker.summonerName}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Champion element ── */}
                {el.type === "champion" && (
                  <div
                    className="w-full h-full rounded-lg flex flex-col items-center justify-center gap-1 p-1"
                    style={{
                      background: "var(--ocaso-card)",
                      border: `1px solid ${isSelected ? "var(--ocaso-purple)" : "var(--ocaso-card-border)"}`,
                      boxShadow: isSelected ? "0 0 20px var(--ocaso-purple-glow)" : "0 2px 8px rgba(0,0,0,0.3)",
                    }}
                  >
                    {(el.content?.imageUrl as string) ? (
                      <img
                        src={el.content?.imageUrl as string}
                        alt={(el.content?.championName as string) || ""}
                        className="w-10 h-10 rounded-full object-cover border-2 border-[var(--ocaso-card-border)]"
                        draggable={false}
                        style={{ pointerEvents: "none" }}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-[var(--ocaso-card-border)] flex items-center justify-center text-[9px] text-[var(--ocaso-text-muted)]" style={{ pointerEvents: "none" }}>
                        ?
                      </div>
                    )}
                    <span className="text-[10px] text-[var(--ocaso-text)] truncate max-w-full text-center leading-tight" style={{ pointerEvents: "none" }}>
                      {el.content?.championName as string}
                    </span>

                    {/* Lock overlay */}
                    {isLockedByOther && el.locker && (
                      <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                        <div className="flex items-center gap-1.5 text-[10px] text-[var(--ocaso-cyan)]">
                          <IconLock />
                          Editando por {el.locker.summonerName}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Rnd>
            );
          })}
        </div>
      </div>

      {/* ════════════════════════════════════════ */}
      {/* CHAMPION PICKER MODAL                     */}
      {/* ════════════════════════════════════════ */}
      {showChampionPicker && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => setShowChampionPicker(false)}
        >
          <div
            className="lol-card w-[480px] max-h-[70vh] flex flex-col animate-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-[var(--ocaso-card-border)]">
              <h3 className="text-sm font-bold text-[var(--ocaso-cyan)] flex items-center gap-2">
                <IconChampionAdd />
                Seleccionar Campeon
              </h3>
              <button
                onClick={() => setShowChampionPicker(false)}
                className="p-1 rounded text-[var(--ocaso-text-muted)] hover:text-[var(--ocaso-text)] hover:bg-[var(--ocaso-card-border)]/30 transition-all"
              >
                <IconClose />
              </button>
            </div>

            {/* Search */}
            <div className="p-3 border-b border-[var(--ocaso-card-border)]">
              <div className="relative">
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ocaso-text-muted)]">
                  <IconSearch />
                </div>
                <input
                  type="text"
                  value={championSearch}
                  onChange={(e) => setChampionSearch(e.target.value)}
                  placeholder="Buscar campeon..."
                  className="input-ocaso w-full text-[11px] pl-8 pr-3 py-1.5"
                  autoFocus
                />
              </div>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto p-3">
              {championsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-[var(--ocaso-purple)] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filteredChamps.length === 0 ? (
                <p className="text-[11px] text-[var(--ocaso-text-muted)] italic text-center py-8">
                  Sin resultados
                </p>
              ) : (
                <div className="grid grid-cols-6 gap-2">
                  {filteredChamps.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => addChampion(c)}
                      className="flex flex-col items-center gap-1 p-1.5 rounded transition-all hover:bg-[var(--ocaso-purple-glow)] border border-transparent hover:border-[var(--ocaso-purple)]/30 cursor-pointer"
                    >
                      {c.imageUrl ? (
                        <img
                          src={c.imageUrl}
                          alt={c.name}
                          className="w-10 h-10 rounded object-cover border border-[var(--ocaso-card-border)]"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded bg-[var(--ocaso-card-border)]" />
                      )}
                      <span className="text-[8px] text-[var(--ocaso-text)] truncate w-full text-center leading-tight">
                        {c.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
