"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { getRoleIcon, IconBack, IconDelete } from "@/components/OcasoIcons";
import WhiteboardPanel from "@/components/WhiteboardPanel";
import ConfirmModal from "@/components/ConfirmModal";
import useWebSocket from "@/hooks/useWebSocket";

// ─── Types ───
interface Champion {
  id: number;
  name: string;
  imageUrl: string;
  title: string;
}

interface User {
  id: number;
  summonerName: string;
  tag: string;
  displayName?: string;
  primaryRole?: string;
}

interface Substitute {
  id: number;
  slotId: number;
  championId: number;
  sortOrder: number;
  champion: Champion;
}

interface Slot {
  id: number;
  role: string;
  user: User;
  champion: Champion;
  substitutes: Substitute[];
}

interface Composition {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
  creator: User;
  slots: Slot[];
}

const ROLES = ["top", "jungle", "mid", "adc", "support"] as const;

const ROLE_LABELS: Record<string, string> = {
  top: "Top",
  jungle: "Jungla",
  mid: "Mid",
  adc: "ADC",
  support: "Soporte",
};

// ─── Main Page Component ───
export default function CompositionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [comp, setComp] = useState<Composition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const { addListener } = useWebSocket();

  // Champion search state for substitutes
  const [champions, setChampions] = useState<Champion[]>([]);
  const [championsLoading, setChampionsLoading] = useState(false);
  const [championSearchSlot, setChampionSearchSlot] = useState<number | null>(null);
  const [championSearch, setChampionSearch] = useState("");
  const [addingSubstitute, setAddingSubstitute] = useState(false);
  const [removingSubstitute, setRemovingSubstitute] = useState<Record<string, boolean>>({});

  // ── Auth helper ──
  const getAuthHeaders = useCallback((): Record<string, string> => {
    const token = localStorage.getItem("lolteam_token");
    return { Authorization: "Bearer " + token };
  }, []);

  // ── Toast ──
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  // ── Fetch composition ──
  const fetchComp = useCallback(async () => {
    try {
      const res = await fetch("/api/compositions/" + params.id, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al cargar");
      } else {
        setComp(data.composition);
      }
    } catch {
      setError("Error del servidor");
    } finally {
      setLoading(false);
    }
  }, [params.id, getAuthHeaders]);

  // ── Fetch champions (for substitute picker) ──
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

  // ── Initial load ──
  useEffect(() => {
    const token = localStorage.getItem("lolteam_token");
    if (!token) {
      router.push("/");
      return;
    }
    fetchComp();
    fetchChampions();
  }, [fetchComp, fetchChampions, router]);

  // ── WebSocket: refetch on composition changes ──
  useEffect(() => {
    const unsub = addListener((msg) => {
      if (msg.type === "data_changed" && (msg.entity === "composition" || msg.entity === "notes")) {
        fetchComp();
      }
    });
    return () => { unsub(); };
  }, [addListener, fetchComp]);

  // ── Handle share (copiar URL) ──
  const handleShare = useCallback(() => {
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => showToast("Link copiado"))
      .catch(() => showToast("No se pudo copiar"));
  }, [showToast]);

  // ── Handle delete ──
  const handleDelete = useCallback(async () => {
    if (!comp) return;
    try {
      const res = await fetch("/api/compositions?id=" + comp.id, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        router.push("/compositions");
      } else {
        showToast("Error al eliminar");
      }
    } catch {
      showToast("Error del servidor");
    }
    setShowDeleteModal(false);
  }, [comp, getAuthHeaders, router, showToast]);

  // ── Handle add substitute ──
  const handleAddSubstitute = useCallback(async (slotId: number, championId: number) => {
    if (!comp || addingSubstitute) return;
    setAddingSubstitute(true);
    try {
      const res = await fetch(`/api/compositions/${comp.id}/substitutes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ slotId, championId }),
      });
      if (res.ok) {
        fetchComp();
        setChampionSearchSlot(null);
        setChampionSearch("");
        showToast("Sustituto agregado");
      } else {
        const data = await res.json();
        showToast(data.error || "Error al agregar sustituto");
      }
    } catch {
      showToast("Error del servidor");
    } finally {
      setAddingSubstitute(false);
    }
  }, [comp, addingSubstitute, getAuthHeaders, fetchComp, showToast]);

  // ── Handle remove substitute ──
  const handleRemoveSubstitute = useCallback(async (slotId: number, championId: number) => {
    if (!comp) return;
    const key = `${slotId}-${championId}`;
    setRemovingSubstitute(prev => ({ ...prev, [key]: true }));
    try {
      const res = await fetch(`/api/compositions/${comp.id}/substitutes`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ slotId, championId }),
      });
      if (res.ok) {
        fetchComp();
        showToast("Sustituto eliminado");
      } else {
        showToast("Error al eliminar sustituto");
      }
    } catch {
      showToast("Error del servidor");
    } finally {
      setRemovingSubstitute(prev => ({ ...prev, [key]: false }));
    }
  }, [comp, getAuthHeaders, fetchComp, showToast]);

  // ── Filtered champions for search ──
  const filteredChamps = champions.filter((c) => {
    const q = championSearch.toLowerCase().trim();
    if (!q) return true;
    return c.name.toLowerCase().includes(q);
  });

  // ── Create a set of already-used champion IDs for the open slot search ──
  const usedChampionIds = new Set<number>();
  if (comp && championSearchSlot != null) {
    comp.slots.forEach((s) => {
      usedChampionIds.add(s.champion.id);
      s.substitutes?.forEach((sub) => usedChampionIds.add(sub.champion.id));
    });
  }

  // ── Loading state ──
  if (loading) {
    return (
      <div className="animate-fade-in space-y-3 max-w-5xl mx-auto p-4">
        <div className="loading-shimmer h-8 w-48" />
        <div className="loading-shimmer h-80 rounded-xl" />
      </div>
    );
  }

  // ── Error state ──
  if (error || !comp) {
    return (
      <div className="max-w-5xl mx-auto p-4 text-center py-20 animate-fade-in">
        <p className="text-xs text-[var(--ocaso-danger)] mb-4">
          {error || "Composicion no encontrada"}
        </p>
        <button
          onClick={() => router.push("/compositions")}
          className="flex items-center gap-1.5 mx-auto text-xs text-[var(--ocaso-cyan)] hover:underline"
        >
          <IconBack size={14} />
          Volver a Composiciones
        </button>
      </div>
    );
  }

  // ── Build role-to-slot map for O(1) lookup ──
  const roleOrder = ["top", "jungle", "mid", "adc", "support"];
  const sortedSlots = [...comp.slots].sort((a,b) => roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role));
  const slotMap = new Map<string, Slot>();
  sortedSlots.forEach((s) => slotMap.set(s.role, s));

  return (
    <div className="max-w-5xl mx-auto p-4 animate-fade-in">
      {/* ── Toast notification ── */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[var(--ocaso-card)] border border-[var(--ocaso-purple)]/40 rounded-xl px-5 py-2.5 text-xs text-[var(--ocaso-purple-light)] shadow-lg animate-up">
          {toast}
        </div>
      )}

      {/* ── Back button ── */}
      <button
        onClick={() => router.push("/compositions")}
        className="flex items-center gap-1 text-[10px] text-[var(--ocaso-text-muted)] hover:text-[var(--ocaso-purple-light)] transition-colors mb-4"
      >
        <IconBack size={12} />
        Composiciones
      </button>

      {/* ════════════════════════════════════════ */}
      {/* HEADER: composition title + creator info */}
      {/* ════════════════════════════════════════ */}
      <div className="mb-5">
        <h1 className="text-lg font-bold text-[var(--ocaso-text)]">{comp.name}</h1>
        {comp.description && (
          <p className="text-xs text-[var(--ocaso-text-muted)] mt-0.5">
            {comp.description}
          </p>
        )}
        <p className="text-[10px] text-[var(--ocaso-text-muted)] mt-1">
          por{" "}
          <span className="text-[var(--ocaso-purple-light)]">
            {comp.creator.summonerName}#{comp.creator.tag}
          </span>
          <span className="mx-1">·</span>
          {new Date(comp.createdAt).toLocaleDateString("es-MX", {
            month: "short",
            day: "numeric",
          })}
        </p>
      </div>

      {/* ════════════════════════════════════════ */}
      {/* TEAM: 5 champion slots with substitutes */}
      {/* ════════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-4">
        {ROLES.map((role) => {
          const slot = slotMap.get(role);

          return (
            <div
              key={role}
              className={"lol-card p-4 text-center transition-all duration-300 " +
                (slot
                  ? "border-[var(--ocaso-purple)]/30"
                  : "border-dashed border-[var(--ocaso-card-border)] opacity-50")
              }
            >
              {/* Role badge */}
              <div className="flex items-center justify-center gap-1.5 mb-3">
                {getRoleIcon(role, 18)}
                <span className="text-[9px] text-[var(--ocaso-purple-light)] font-semibold uppercase tracking-wider">
                  {ROLE_LABELS[role] || role}
                </span>
              </div>

              {slot ? (
                <>
                  {/* Champion image: BIG (w-20 h-20 = 80px) */}
                  {slot.champion.imageUrl ? (
                    <img
                      src={slot.champion.imageUrl}
                      alt={slot.champion.name}
                      className="w-20 h-20 mx-auto rounded-xl border-2 border-[var(--ocaso-card-border)] object-cover mb-2"
                    />
                  ) : (
                    <div className="w-20 h-20 mx-auto rounded-xl bg-[var(--ocaso-card-border)] flex items-center justify-center text-[9px] text-[var(--ocaso-text-muted)] mb-2">
                      {slot.champion.name.slice(0, 3)}
                    </div>
                  )}

                  {/* Champion name */}
                  <p className="text-sm font-bold text-[var(--ocaso-text)] truncate">
                    {slot.champion.name}
                  </p>

                  {/* Player info */}
                  <div className="mt-2 pt-2 border-t border-[var(--ocaso-card-border)]">
                    <div className="flex items-center justify-center gap-1.5 mb-0.5">
                      <div className="w-5 h-5 rounded-full bg-[var(--ocaso-purple)]/20 border border-[var(--ocaso-purple)]/30 flex items-center justify-center shrink-0">
                        <span className="text-[8px] font-semibold text-[var(--ocaso-purple-light)]">
                          {slot.user.summonerName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--ocaso-text)] truncate">
                        {slot.user.summonerName}
                      </p>
                    </div>
                    <p className="text-[9px] text-[var(--ocaso-cyan)]">
                      #{slot.user.tag}
                    </p>
                  </div>

                  {/* ── Substitutes section ── */}
                  {slot.substitutes && slot.substitutes.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-[var(--ocaso-card-border)]/50">
                      <p className="text-[8px] text-[var(--ocaso-text-muted)] uppercase tracking-wider mb-1.5 font-semibold">
                        Sustitutos
                      </p>
                      <div className="flex flex-wrap justify-center gap-1.5">
                        {slot.substitutes.map((sub) => {
                          const rmKey = `${slot.id}-${sub.champion.id}`;
                          const isRemoving = removingSubstitute[rmKey];
                          return (
                            <div
                              key={sub.id}
                              className="relative group"
                            >
                              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--ocaso-bg)]/50 border border-[var(--ocaso-card-border)]">
                                {sub.champion.imageUrl ? (
                                  <img
                                    src={sub.champion.imageUrl}
                                    alt={sub.champion.name}
                                    className="w-6 h-6 rounded object-cover shrink-0"
                                  />
                                ) : (
                                  <div className="w-6 h-6 rounded bg-[var(--ocaso-card-border)] shrink-0" />
                                )}
                                <span className="text-[9px] text-[var(--ocaso-text)] truncate max-w-[60px]">
                                  {sub.champion.name}
                                </span>
                                <button
                                  onClick={() => handleRemoveSubstitute(slot.id, sub.champion.id)}
                                  disabled={isRemoving}
                                  className="p-0.5 rounded text-[var(--ocaso-text-muted)] hover:text-[var(--ocaso-danger)] hover:bg-[var(--ocaso-danger)]/10 transition-all shrink-0"
                                  title="Eliminar sustituto"
                                >
                                  {isRemoving ? (
                                    <div className="w-3 h-3 border border-[var(--ocaso-danger)] border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                      <line x1="18" y1="6" x2="6" y2="18" />
                                      <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                  )}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ── Add substitute button ── */}
                  <div className="mt-2">
                    <button
                      onClick={() => {
                        setChampionSearchSlot(championSearchSlot === slot.id ? null : slot.id);
                        setChampionSearch("");
                      }}
                      className="text-[9px] px-2 py-1 rounded border border-dashed border-[var(--ocaso-card-border)] text-[var(--ocaso-text-muted)] hover:text-[var(--ocaso-cyan)] hover:border-[var(--ocaso-cyan)]/30 transition-all w-full"
                    >
                      + Agregar sustituto
                    </button>
                  </div>

                  {/* ── Champion search panel ── */}
                  {championSearchSlot === slot.id && (
                    <div className="mt-2 p-2 rounded bg-[var(--ocaso-bg)] border border-[var(--ocaso-card-border)]">
                      <input
                        type="text"
                        placeholder="Buscar campeón..."
                        value={championSearch}
                        onChange={(e) => setChampionSearch(e.target.value)}
                        className="input-ocaso w-full text-[10px] px-2 py-1.5 mb-2"
                        autoFocus
                      />
                      {championsLoading ? (
                        <div className="flex justify-center py-4">
                          <div className="w-5 h-5 border-2 border-[var(--ocaso-purple)] border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : (
                        <div className="grid grid-cols-4 gap-1 max-h-[180px] overflow-y-auto">
                          {filteredChamps.length === 0 ? (
                            <p className="col-span-full text-[9px] text-[var(--ocaso-text-muted)] italic text-center py-2">
                              Sin resultados
                            </p>
                          ) : (
                            filteredChamps.map((c) => {
                              const isUsed = usedChampionIds.has(c.id);
                              return (
                                <button
                                  key={c.id}
                                  onClick={() => {
                                    if (!isUsed) handleAddSubstitute(slot.id, c.id);
                                  }}
                                  disabled={isUsed || addingSubstitute}
                                  className={`flex flex-col items-center gap-0.5 p-1 rounded transition-all ${
                                    isUsed
                                      ? "opacity-30 cursor-not-allowed"
                                      : "hover:bg-[var(--ocaso-purple-glow)] cursor-pointer border border-transparent hover:border-[var(--ocaso-purple)]/30"
                                  }`}
                                >
                                  {c.imageUrl ? (
                                    <img
                                      src={c.imageUrl}
                                      alt={c.name}
                                      className="w-8 h-8 rounded object-cover border border-[var(--ocaso-card-border)]"
                                    />
                                  ) : (
                                    <div className="w-8 h-8 rounded bg-[var(--ocaso-card-border)]" />
                                  )}
                                  <span className="text-[7px] text-[var(--ocaso-text)] truncate w-full text-center leading-tight">
                                    {c.name}
                                  </span>
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                /* Empty slot placeholder (dashed) */
                <div className="flex flex-col items-center justify-center py-3 gap-1">
                  <div className="w-20 h-20 mx-auto rounded-xl bg-[var(--ocaso-bg)] border-2 border-dashed border-[var(--ocaso-card-border)] flex items-center justify-center">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      className="text-[var(--ocaso-text-muted)]"
                    >
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </div>
                  <p className="text-[10px] text-[var(--ocaso-text-muted)] font-medium italic">
                    Sin asignar
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ════════════════════════════════════════ */}
      {/* ACTION BAR: Editar / Compartir / Eliminar*/}
      {/* ════════════════════════════════════════ */}
      <div className="flex flex-wrap gap-2 mb-6">
        {/* Editar (ir al creador con esta comp cargada) */}
        <button
          onClick={() => router.push("/compositions/new?edit=" + comp.id)}
          className="btn-ocaso flex items-center gap-1.5 px-4 py-2 text-xs"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          Editar equipo
        </button>

        {/* Compartir Link (copiar URL) */}
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-[var(--ocaso-bg)] border border-[var(--ocaso-card-border)] text-[var(--ocaso-text-muted)] hover:text-[var(--ocaso-purple-light)] hover:border-[var(--ocaso-purple)]/30 transition-all"
        >
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
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          Compartir Link
        </button>

        {/* Eliminar (modal confirmación) */}
        <button
          onClick={() => setShowDeleteModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-[var(--ocaso-bg)] border border-[var(--ocaso-card-border)] text-[var(--ocaso-text-muted)] hover:text-[var(--ocaso-danger)] hover:border-[var(--ocaso-danger)]/30 transition-all"
        >
          <IconDelete size={12} />
          Eliminar
        </button>
      </div>

      {/* ════════════════════════════════════════ */}
      {/* PIZARRA TACTICA                          */}
      {/* ════════════════════════════════════════ */}
      <div className="mt-6">
        <h2 className="text-sm font-bold text-[var(--ocaso-cyan)] mb-3 flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
          Pizarra Tactica
        </h2>
        <WhiteboardPanel compositionId={comp.id} />
      </div>

      <ConfirmModal
        open={showDeleteModal}
        title="Eliminar composición"
        message={`¿Eliminar "${comp.name}"? Esta acción no se puede deshacer.`}
        confirmText="Sí, eliminar"
        danger
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
      />
    </div>
  );
}
