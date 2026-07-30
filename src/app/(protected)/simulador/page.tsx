"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import useDraftWebSocket from "@/hooks/useDraftWebSocket";
import {
  DRAFT_STEPS,
  TOTAL_STEPS,
  PHASES,
  DraftState,
  DraftSide,
  createInitialState,
  filterCompositions,
  getCurrentStepInfo,
  getPhaseLabel,
  Composition,
  FilteredComp,
  CompSlot,
  FilteredSlot,
} from "@/lib/draft";
import { IconBack } from "@/components/OcasoIcons";

// ─── Types ───

interface Champion {
  id: number;
  name: string;
  imageUrl: string;
}

// ─── Helpers ───

/** Extract bans by team from the flat banned[] array using step order. */
function getBansBySide(state: DraftState): Record<DraftSide, number[]> {
  const bans: Record<DraftSide, number[]> = { blue: [], red: [] };
  let banIdx = 0;
  for (let i = 0; i < state.currentStep; i++) {
    if (DRAFT_STEPS[i].action === "ban") {
      if (banIdx < state.banned.length) {
        bans[DRAFT_STEPS[i].side].push(state.banned[banIdx]);
        banIdx++;
      }
    }
  }
  return bans;
}

/** Count how many bans/picks of each type were made before the current step. */
function countsBeforeStep(currentStep: number) {
  let bans = 0;
  let bluePicks = 0;
  let redPicks = 0;
  for (let i = 0; i < currentStep; i++) {
    const s = DRAFT_STEPS[i];
    if (s.action === "ban") bans++;
    else if (s.action === "pick" && s.side === "blue") bluePicks++;
    else if (s.action === "pick" && s.side === "red") redPicks++;
  }
  return { bans, bluePicks, redPicks };
}

/** Check if the user has already selected a champion for the current step. */
function stepHasSelection(state: DraftState): boolean {
  if (state.currentStep >= TOTAL_STEPS) return false;
  const step = DRAFT_STEPS[state.currentStep];
  const before = countsBeforeStep(state.currentStep);
  if (step.action === "ban") return state.banned.length > before.bans;
  if (step.action === "pick" && step.side === "blue")
    return state.bluePicks.length > before.bluePicks;
  if (step.action === "pick" && step.side === "red")
    return state.redPicks.length > before.redPicks;
  return false;
}

/** Get picks in display order for a given side. */
function getPicksForSide(
  side: DraftSide,
  bluePicks: number[],
  redPicks: number[]
): number[] {
  return side === "blue" ? bluePicks : redPicks;
}

// ─── Sub-components ───

function BanSlot({
  champion,
}: {
  champion: { id: number; name: string; imageUrl: string } | null;
}) {
  return (
    <div className="w-10 h-10 rounded border border-[var(--ocaso-card-border)] overflow-hidden relative shrink-0">
      {champion ? (
        <>
          <img
            src={champion.imageUrl}
            alt=""
            className="w-full h-full object-cover opacity-50"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--ocaso-danger)"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
        </>
      ) : (
        <div className="w-full h-full border border-dashed border-[var(--ocaso-card-border)] bg-[var(--ocaso-bg)]/30 flex items-center justify-center">
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--ocaso-text-muted)"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </div>
      )}
    </div>
  );
}

function PickSlot({
  champion,
  index,
  isCurrent,
  side,
}: {
  champion: { id: number; name: string; imageUrl: string } | null;
  index: number;
  isCurrent: boolean;
  side: DraftSide;
}) {
  return (
    <div
      className={`flex items-center gap-2 p-1.5 rounded border transition-all ${
        isCurrent
          ? "border-[var(--ocaso-purple)]/60 bg-[var(--ocaso-purple-glow)]"
          : "border-[var(--ocaso-card-border)]"
      } ${!champion ? "border-dashed" : ""}`}
    >
      <div className="w-8 h-8 rounded overflow-hidden shrink-0">
        {champion ? (
          <img
            src={champion.imageUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full border border-dashed border-[var(--ocaso-card-border)] bg-[var(--ocaso-bg)]/30" />
        )}
      </div>
      <span className="text-[10px] text-[var(--ocaso-text)] truncate">
        {champion ? champion.name : (isCurrent ? "▼ Pick actual" : `Pick ${index + 1}`)}
      </span>
    </div>
  );
}

function CompCard({
  comp,
  championMap,
  votes,
  onVote,
  onUnvote,
  votedCompIds,
}: {
  comp: FilteredComp;
  championMap: Map<number, Champion>;
  votes?: Record<number, number>;
  onVote?: (compId: number) => void;
  onUnvote?: (compId: number) => void;
  votedCompIds?: Set<number>;
}) {
  // Sort slots by role
  const roleOrder = ["top", "jungle", "mid", "adc", "support"];
  const sortedSlots = [...comp.slots].sort(
    (a, b) => roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role)
  );

  const voteCount = votes?.[comp.id] ?? 0;
  const hasVoted = votedCompIds?.has(comp.id) ?? false;

  return (
    <div
      className={`p-2 rounded border transition-all ${
        hasVoted
          ? "border-[var(--ocaso-cyan)]/50 bg-[var(--ocaso-cyan)]/5"
          : "border-[var(--ocaso-card-border)]"
      }`}
    >
      {/* Header with name and vote button */}
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-[var(--ocaso-text)] truncate">
            {comp.name}
          </p>
          <p className="text-[9px] text-[var(--ocaso-text-muted)]">
            por {comp.creator.summonerName}
          </p>
        </div>

        {/* Vote button */}
        {onVote && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (hasVoted) {
                onUnvote?.(comp.id);
              } else {
                onVote(comp.id);
              }
            }}
            className={`flex items-center gap-0.5 shrink-0 px-1.5 py-0.5 rounded transition-all text-[10px] ${
              hasVoted
                ? "text-[var(--ocaso-cyan)] bg-[var(--ocaso-cyan)]/10"
                : "text-[var(--ocaso-text-muted)] hover:text-[var(--ocaso-cyan)] hover:bg-[var(--ocaso-cyan)]/5"
            }`}
            title={hasVoted ? "Quitar voto" : "Votar"}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill={hasVoted ? "var(--ocaso-cyan)" : "none"}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            {voteCount > 0 && <span>{voteCount}</span>}
          </button>
        )}
      </div>

      {/* Champion icons */}
      <div className="flex -space-x-1 mt-1.5">
        {sortedSlots.map((s, i) => (
          <div
            key={i}
            title={s.isSubstituted ? s.substituteReason : undefined}
            className={`w-7 h-7 rounded-full border-2 overflow-hidden ${
              s.isSubstituted
                ? "border-[var(--ocaso-purple)] ring-1 ring-[var(--ocaso-purple)]/50"
                : "border-[var(--ocaso-card)]"
            }`}
          >
            {s.activeChampion.imageUrl ? (
              <img
                src={s.activeChampion.imageUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-[var(--ocaso-card-border)]" />
            )}
          </div>
        ))}
      </div>

      {/* Substitution labels */}
      {sortedSlots.some((s) => s.isSubstituted) && (
        <div className="flex flex-wrap gap-1 mt-1">
          {sortedSlots
            .filter((s) => s.isSubstituted)
            .map((s, i) => (
              <span
                key={i}
                className="text-[8px] text-[var(--ocaso-purple-light)] leading-tight"
              >
                ↳ {s.activeChampion.name} ({s.substituteReason})
              </span>
            ))}
        </div>
      )}
    </div>
  );
}

function PhaseIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center gap-1 mb-3">
      {PHASES.map((phase, i) => {
        const isActive =
          currentStep >= phase.start && currentStep <= phase.end;
        const isPast = currentStep > phase.end;
        return (
          <div
            key={i}
            className={`flex items-center gap-1 text-[9px] transition-all ${
              isActive
                ? "text-[var(--ocaso-cyan)] font-semibold"
                : isPast
                ? "text-[var(--ocaso-text-muted)]"
                : "text-[var(--ocaso-text-muted)]/50"
            }`}
          >
            {i > 0 && (
              <svg
                width="8"
                height="8"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="opacity-40"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            )}
            <span>{phase.name}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Page Component ───

export default function SimuladorDraftPage() {
  const router = useRouter();

  // ── URL-based session detection ──
  const searchParams =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : null;
  const sessionParam = searchParams?.get("session");
  const [isSpectating, setIsSpectating] = useState(!!sessionParam);

  // ── Draft WebSocket ──
  const ws = useDraftWebSocket();

  // ── Join session on mount (spectator mode) ──
  useEffect(() => {
    if (sessionParam) {
      ws.joinSession(sessionParam);
    }
    // Only run on mount when sessionParam changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionParam]);

  // ── Local voting tracking ──
  const [userVotedCompIds, setUserVotedCompIds] = useState<Set<number>>(new Set());

  // ── State ──
  const [state, setState] = useState<DraftState>(createInitialState);
  const [champions, setChampions] = useState<Champion[]>([]);
  const [compositions, setCompositions] = useState<Composition[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showDead, setShowDead] = useState(false);
  // Champion selected for the current step (not yet confirmed)
  const [currentSelection, setCurrentSelection] = useState<number | null>(null);

  // ── Auth + Data Loading ──
  useEffect(() => {
    const token = localStorage.getItem("lolteam_token");
    if (!token) {
      router.push("/");
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const [compRes, champRes] = await Promise.all([
          fetch("/api/compositions", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("/api/champions"),
        ]);
        const compData = await compRes.json();
        const champData = await champRes.json();
        if (!cancelled) {
          setCompositions(compData.compositions || []);
          setChampions(champData.champions || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // ── Champion lookup map ──
  const championMap = useMemo(() => {
    const map = new Map<number, Champion>();
    for (const c of champions) map.set(c.id, c);
    return map;
  }, [champions]);

  // ── Derived state ──

  // Source of truth: local state for normal/creator, WS state for spectator
  const draftSource = isSpectating && ws.draftState ? ws.draftState : state;

  const stepInfo = useMemo(
    () => getCurrentStepInfo(draftSource),
    [draftSource]
  );

  const filteredComps = useMemo(() => {
    if (!draftSource.side) return [];
    return filterCompositions(compositions, draftSource, draftSource.side);
  }, [compositions, draftSource]);

  const aliveComps = useMemo(
    () => filteredComps.filter((c) => c.deadReasons.length === 0),
    [filteredComps]
  );
  const deadComps = useMemo(
    () => filteredComps.filter((c) => c.deadReasons.length > 0),
    [filteredComps]
  );

  const filteredChamps = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return champions;
    return champions.filter((c) => c.name.toLowerCase().includes(q));
  }, [champions, search]);

  const selectedIds = useMemo(() => {
    const s = new Set<number>();
    for (const id of draftSource.banned) s.add(id);
    for (const id of draftSource.bluePicks) s.add(id);
    for (const id of draftSource.redPicks) s.add(id);
    // Don't grey out the current step's selection
    if (currentSelection != null) s.delete(currentSelection);
    return s;
  }, [draftSource, currentSelection]);

  const hasSelection = useMemo(
    () => currentSelection != null || stepHasSelection(draftSource),
    [draftSource, currentSelection]
  );

  // Determine which pick slot (0-4) is the current step for highlighting
  const currentPickIndex = useMemo(() => {
    const isCmpl = draftSource.currentStep >= TOTAL_STEPS;
    const si = getCurrentStepInfo(draftSource);
    if (isCmpl || !si) return -1;
    if (si.step.action !== "pick") return -1;
    const before = countsBeforeStep(draftSource.currentStep);
    return si.step.side === "blue" ? before.bluePicks : before.redPicks;
  }, [draftSource]);

  const isComplete = draftSource.currentStep >= TOTAL_STEPS;

  // ── Handlers ──
  const handleSelectSide = useCallback(
    (side: DraftSide) => {
      setState((prev) => ({ ...prev, side }));
      ws.createSession(side);
    },
    [ws.createSession]
  );

  const handleChampionClick = useCallback(
    (champ: Champion) => {
      if (!stepInfo || selectedIds.has(champ.id)) return;
      // Set current selection (not yet confirmed)
      setCurrentSelection(champ.id);
    },
    [stepInfo, selectedIds]
  );

  const handleNextStep = useCallback(() => {
    setState((prev) => {
      if (prev.currentStep >= TOTAL_STEPS) return prev;
      // Confirm the current selection into the step's action
      const step = DRAFT_STEPS[prev.currentStep];
      if (currentSelection != null) {
        if (step.action === "ban") {
          return { ...prev, banned: [...prev.banned, currentSelection], currentStep: prev.currentStep + 1 };
        }
        if (step.action === "pick" && step.side === "blue") {
          return { ...prev, bluePicks: [...prev.bluePicks, currentSelection], currentStep: prev.currentStep + 1 };
        }
        if (step.action === "pick" && step.side === "red") {
          return { ...prev, redPicks: [...prev.redPicks, currentSelection], currentStep: prev.currentStep + 1 };
        }
      }
      return { ...prev, currentStep: prev.currentStep + 1 };
    });
    setCurrentSelection(null);
    setSearch("");
  }, [currentSelection]);

  const handleReset = useCallback(() => {
    setState(createInitialState());
    setSearch("");
    setShowDead(false);
    setCurrentSelection(null);
  }, []);

  // ── Real-time state sync (creator mode, debounced) ──
  const stateSyncTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  useEffect(() => {
    if (!ws.isCreator || !ws.sessionId || !state.side) return;
    if (stateSyncTimerRef.current) clearTimeout(stateSyncTimerRef.current);
    stateSyncTimerRef.current = setTimeout(() => {
      ws.updateState(state);
    }, 300);
    return () => {
      if (stateSyncTimerRef.current) clearTimeout(stateSyncTimerRef.current);
    };
  }, [state, ws.sessionId, ws.isCreator, ws.updateState]);

  // ── Loading state ──
  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="loading-shimmer h-16 rounded" />
        ))}
      </div>
    );
  }

  // ── Spectator connecting state ──
  if (isSpectating && !ws.draftState) {
    return (
      <div className="max-w-3xl mx-auto p-4 animate-fade-in">
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <p className="text-[var(--ocaso-text-muted)] text-sm">
              Conectando a la sesión...
            </p>
            <div className="mt-3 w-6 h-6 border-2 border-[var(--ocaso-purple)] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  // ── Side Selector (pre-draft) - hidden in spectator mode ──
  if (!isSpectating && !state.side) {
    return (
      <div className="max-w-xl mx-auto p-4 animate-fade-in">
        {/* Back */}
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-1 text-[var(--ocaso-text-muted)] hover:text-[var(--ocaso-text)] transition-colors"
          >
            <IconBack size={16} />
            <span className="text-[11px]">Simulador</span>
          </button>
        </div>

        <h1 className="text-lg font-bold text-[var(--ocaso-text)] mb-2">
          Simulador de Draft
        </h1>
        <p className="text-[11px] text-[var(--ocaso-text-muted)] mb-6">
          Selecciona tu lado para comenzar la simulación
        </p>

        <div className="grid grid-cols-2 gap-4">
          {/* Blue card */}
          <button
            onClick={() => handleSelectSide("blue")}
            className="lol-card p-6 text-center cursor-pointer hover:scale-[1.02] hover:border-[var(--ocaso-purple)]/60 transition-all border-[var(--ocaso-purple)]/30"
            style={{
              background:
                "linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(34,211,238,0.05) 100%)",
            }}
          >
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-[var(--ocaso-purple-glow)] flex items-center justify-center">
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="#A78BFA"
              >
                <path d="M12 2 L15 9 L22 9 L16 14 L18 21 L12 17 L6 21 L8 14 L2 9 L9 9 Z" />
              </svg>
            </div>
            <p className="text-lg font-bold text-[var(--ocaso-text)]">
              LADO AZUL
            </p>
            <p className="text-[11px] text-[var(--ocaso-text-muted)] mt-1">
              Primer pick
            </p>
          </button>

          {/* Red card */}
          <button
            onClick={() => handleSelectSide("red")}
            className="lol-card p-6 text-center cursor-pointer hover:scale-[1.02] hover:border-[var(--ocaso-danger)]/60 transition-all border-[var(--ocaso-danger)]/30"
            style={{
              background:
                "linear-gradient(135deg, rgba(232,64,87,0.12) 0%, rgba(124,58,237,0.05) 100%)",
            }}
          >
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-[var(--ocaso-danger)]/10 flex items-center justify-center">
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="#E84057"
              >
                <path d="M12 2 L15 9 L22 9 L16 14 L18 21 L12 17 L6 21 L8 14 L2 9 L9 9 Z" />
              </svg>
            </div>
            <p className="text-lg font-bold text-[var(--ocaso-text)]">
              LADO ROJO
            </p>
            <p className="text-[11px] text-[var(--ocaso-text-muted)] mt-1">
              Último counterpick
            </p>
          </button>
        </div>

        {/* Active sessions from other users */}
        {ws.activeSessions.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xs font-semibold text-[var(--ocaso-text)] mb-3 flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              Simulaciones activas
            </h2>
            <div className="space-y-2">
              {ws.activeSessions.map((session) => (
                <button
                  key={session.sessionId}
                  onClick={() => {
                    window.location.href = "/simulador?session=" + session.sessionId;
                  }}
                  className="lol-card w-full p-3 text-left cursor-pointer hover:border-[var(--ocaso-cyan)]/40 transition-all flex items-center gap-3"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
                    session.side === "blue"
                      ? "bg-[var(--ocaso-purple)]/20 text-[var(--ocaso-cyan)] border border-[var(--ocaso-purple)]/30"
                      : "bg-[var(--ocaso-danger)]/10 text-[var(--ocaso-danger)] border border-[var(--ocaso-danger)]/30"
                  }`}>
                    {session.side === "blue" ? "AZ" : "RJ"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[var(--ocaso-text)] truncate">
                      {session.creatorName}<span className="text-[var(--ocaso-cyan)] text-[10px]">#{session.creatorTag}</span>
                    </p>
                    <p className="text-[9px] text-[var(--ocaso-text-muted)]">
                      Lado {session.side === "blue" ? "Azul" : "Rojo"} · {session.spectatorCount} espectador{session.spectatorCount !== 1 ? "es" : ""}
                    </p>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--ocaso-text-muted)] shrink-0">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Draft Active UI ──

  const ourSide = draftSource.side as DraftSide;
  const enemySide: DraftSide = ourSide === "blue" ? "red" : "blue";
  const bansBySide = getBansBySide(draftSource);
  const ourPicks = getPicksForSide(
    ourSide,
    draftSource.bluePicks,
    draftSource.redPicks
  );
  const enemyPicks = getPicksForSide(
    enemySide,
    draftSource.bluePicks,
    draftSource.redPicks
  );
  const ourLabel = ourSide === "blue" ? "AZUL" : "ROJO";
  const enemyLabel = enemySide === "blue" ? "AZUL" : "ROJO";

  return (
    <div className="max-w-6xl mx-auto p-4 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-1 text-[var(--ocaso-text-muted)] hover:text-[var(--ocaso-text)] transition-colors"
          >
            <IconBack size={16} />
            <span className="text-[11px]">Simulador</span>
          </button>
          {isSpectating && (
            <span className="badge-ocaso text-[9px] px-2 py-0.5">
              MODO ESPECTADOR
            </span>
          )}
          {!isSpectating && ws.sessionId && ws.spectatorCount > 0 && (
            <span className="text-[10px] text-[var(--ocaso-text-muted)] flex items-center gap-1">
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
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              {ws.spectatorCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isSpectating && ws.sessionId && ws.isCreator && (
            <button
              onClick={() => {
                const url =
                  window.location.origin +
                  "/simulador?session=" +
                  ws.sessionId;
                navigator.clipboard.writeText(url);
              }}
              className="text-[10px] px-2.5 py-1.5 rounded-lg border border-[var(--ocaso-cyan)]/40 text-[var(--ocaso-cyan)] hover:bg-[var(--ocaso-cyan)]/10 transition-all"
            >
              Compartir simulación
            </button>
          )}
          {!isSpectating && (
            <button
              onClick={handleReset}
              className="text-[10px] px-2.5 py-1.5 rounded-lg border border-[var(--ocaso-card-border)] text-[var(--ocaso-text-muted)] hover:text-[var(--ocaso-danger)] hover:border-[var(--ocaso-danger)]/40 transition-all"
            >
              Reiniciar
            </button>
          )}
        </div>
      </div>

      <h1 className="text-base font-bold text-[var(--ocaso-text)] mb-4">
        Simulador de Draft
      </h1>

      {/* ── Phase indicator ── */}
      <PhaseIndicator currentStep={draftSource.currentStep} />

      {/* ── Champion Picker (top, always accessible) ── */}
      {!isSpectating && !isComplete && stepInfo && (
        <div className="lol-card p-4 mb-4">
          {/* Current step info */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-semibold text-[var(--ocaso-text)]">
                Paso {state.currentStep + 1}/{TOTAL_STEPS} &mdash;{" "}
                {stepInfo.step.label}
              </p>
              <p className="text-[10px] text-[var(--ocaso-text-muted)]">
                {getPhaseLabel(state.currentStep)}
                {stepInfo.step.side === "blue"
                  ? " · Equipo Azul"
                  : " · Equipo Rojo"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {stepInfo.isOurTurn && (
                <span className="badge-ocaso text-[9px] px-2 py-0.5">
                  ¡TU TURNO!
                </span>
              )}
              {currentSelection != null && (
                <span className="badge-ocaso text-[9px] px-2 py-0.5 text-[var(--ocaso-cyan)] border-[var(--ocaso-cyan)]/40">
                  {championMap.get(currentSelection)?.name || ""} seleccionado
                </span>
              )}
            </div>
          </div>

          {/* Search */}
          <div className="mb-3">
            <input
              type="text"
              placeholder="Buscar campeón..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-ocaso w-full text-xs px-3 py-2"
            />
          </div>

          {/* Champion grid */}
          <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-1.5 mb-3 max-h-[260px] overflow-y-auto p-0.5">
            {filteredChamps.length === 0 ? (
              <p className="col-span-full text-[10px] text-[var(--ocaso-text-muted)] italic py-4 text-center">
                Sin resultados
              </p>
            ) : (
              filteredChamps.map((c) => {
                const isSelected = selectedIds.has(c.id);
                const isCurrentPick = currentSelection === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => handleChampionClick(c)}
                    disabled={isSelected}
                    className={`flex flex-col items-center gap-0.5 p-1 rounded transition-all ${
                      isCurrentPick
                        ? "bg-[var(--ocaso-purple-glow)] ring-2 ring-[var(--ocaso-purple)]"
                        : isSelected
                        ? "opacity-30 cursor-not-allowed"
                        : "hover:bg-[var(--ocaso-purple-glow)] hover:border-[var(--ocaso-purple)]/30 cursor-pointer border border-transparent"
                    }`}
                  >
                    <div className="w-10 h-10 rounded overflow-hidden border border-[var(--ocaso-card-border)]">
                      <img
                        src={c.imageUrl}
                        alt={c.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="text-[8px] text-[var(--ocaso-text)] truncate w-full text-center leading-tight">
                      {c.name}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* Next step button */}
          <div className="flex justify-end">
            <button
              onClick={handleNextStep}
              disabled={!hasSelection}
              className={`btn-ocaso text-[11px] px-4 py-1.5 flex items-center gap-1.5 ${
                !hasSelection ? "opacity-40 cursor-not-allowed" : ""
              }`}
            >
              Siguiente paso
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ── Main grid ── */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* ──────── Left: Draft Board ──────── */}
        <div className="flex-1 min-w-0">
          <div className="grid grid-cols-2 gap-3">
            {/* NOSOTROS */}
            <div className="lol-card p-3">
              <h2 className="text-[11px] font-bold text-[var(--ocaso-purple-light)] uppercase tracking-wider mb-2">
                {ourLabel} · NOSOTROS
              </h2>

              {/* Bans */}
              <div className="mb-3">
                <p className="text-[9px] text-[var(--ocaso-text-muted)] uppercase font-semibold mb-1.5">
                  Baneos
                </p>
                <div className="flex gap-1 flex-wrap">
                  {Array.from({ length: 5 }).map((_, i) => {
                    const champId = bansBySide[ourSide][i];
                    const champ = champId ? championMap.get(champId) ?? null : null;
                    return <BanSlot key={i} champion={champ} />;
                  })}
                </div>
              </div>

              {/* Picks */}
              <div>
                <p className="text-[9px] text-[var(--ocaso-text-muted)] uppercase font-semibold mb-1.5">
                  Picks
                </p>
                <div className="space-y-1">
                  {Array.from({ length: 5 }).map((_, i) => {
                    const champId = ourPicks[i];
                    const champ = champId ? championMap.get(champId) ?? null : null;
                    const isCurrent =
                      !isComplete &&
                      stepInfo?.step.action === "pick" &&
                      stepInfo.step.side === ourSide &&
                      currentPickIndex === i;
                    return (
                      <PickSlot
                        key={i}
                        champion={champ}
                        index={i}
                        isCurrent={isCurrent}
                        side={ourSide}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ELLOS */}
            <div className="lol-card p-3">
              <h2 className="text-[11px] font-bold text-[var(--ocaso-text-muted)] uppercase tracking-wider mb-2">
                {enemyLabel} · ELLOS
              </h2>

              {/* Bans */}
              <div className="mb-3">
                <p className="text-[9px] text-[var(--ocaso-text-muted)] uppercase font-semibold mb-1.5">
                  Baneos
                </p>
                <div className="flex gap-1 flex-wrap">
                  {Array.from({ length: 5 }).map((_, i) => {
                    const champId = bansBySide[enemySide][i];
                    const champ = champId ? championMap.get(champId) ?? null : null;
                    return <BanSlot key={i} champion={champ} />;
                  })}
                </div>
              </div>

              {/* Picks */}
              <div>
                <p className="text-[9px] text-[var(--ocaso-text-muted)] uppercase font-semibold mb-1.5">
                  Picks
                </p>
                <div className="space-y-1">
                  {Array.from({ length: 5 }).map((_, i) => {
                    const champId = enemyPicks[i];
                    const champ = champId ? championMap.get(champId) ?? null : null;
                    const isCurrent =
                      !isComplete &&
                      stepInfo?.step.action === "pick" &&
                      stepInfo.step.side === enemySide &&
                      currentPickIndex === i;
                    return (
                      <PickSlot
                        key={i}
                        champion={champ}
                        index={i}
                        isCurrent={isCurrent}
                        side={enemySide}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ──────── Right: Composition Filter List ──────── */}
        <div className="w-full lg:w-72 shrink-0">
          <div className="lol-card p-3">
            <h3 className="text-[11px] font-bold text-[var(--ocaso-text)] mb-2">
              Composiciones disponibles ({aliveComps.length})
            </h3>
            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1 scrollbar-thin mb-2">
              {aliveComps.length === 0 ? (
                <p className="text-[10px] text-[var(--ocaso-text-muted)] italic py-4 text-center">
                  Ninguna composición disponible
                </p>
              ) : (
                aliveComps.map((comp) => (
                  <CompCard
                    key={comp.id}
                    comp={comp}
                    championMap={championMap}
                    votes={ws.votes}
                    onVote={(compId) => {
                      ws.vote(compId);
                      setUserVotedCompIds(prev => new Set(prev).add(compId));
                    }}
                    onUnvote={(compId) => {
                      ws.unvote(compId);
                      setUserVotedCompIds(prev => {
                        const next = new Set(prev);
                        next.delete(compId);
                        return next;
                      });
                    }}
                    votedCompIds={userVotedCompIds}
                  />
                ))
              )}
            </div>

            {/* Toggle dead comps */}
            {deadComps.length > 0 && (
              <>
                <button
                  onClick={() => setShowDead(!showDead)}
                  className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-[10px] text-[var(--ocaso-text-muted)] hover:text-[var(--ocaso-text)] hover:bg-[var(--ocaso-purple-glow)] transition-all"
                >
                  <span>Descartadas ({deadComps.length})</span>
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    className={`transition-transform ${showDead ? "rotate-180" : ""}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {showDead && (
                  <div className="space-y-2 mt-2 max-h-[240px] overflow-y-auto pr-1 scrollbar-thin pt-2 border-t border-[var(--ocaso-card-border)]">
                    {deadComps.map((comp) => (
                      <div
                        key={comp.id}
                        className="p-2 rounded border border-[var(--ocaso-card-border)] opacity-60"
                      >
                        <p className="text-[10px] font-medium text-[var(--ocaso-text)] truncate">
                          {comp.name}
                        </p>
                        <div className="flex -space-x-1 mt-1">
                          {[...comp.slots]
                            .sort((a,b) => ["top","jungle","mid","adc","support"].indexOf(a.role) - ["top","jungle","mid","adc","support"].indexOf(b.role))
                            .map((s, i) => (
                              <div
                                key={i}
                                title={s.isSubstituted ? s.substituteReason : undefined}
                                className={`w-5 h-5 rounded-full border-2 overflow-hidden ${
                                  s.isSubstituted
                                    ? "border-[var(--ocaso-purple)] ring-1 ring-[var(--ocaso-purple)]/50"
                                    : "border-[var(--ocaso-card)]"
                                }`}
                              >
                                {s.activeChampion.imageUrl ? (
                                  <img src={s.activeChampion.imageUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full bg-[var(--ocaso-card-border)]" />
                                )}
                              </div>
                            ))}
                        </div>
                        <p className="text-[8px] text-[var(--ocaso-danger)] leading-tight mt-1">
                          {comp.deadReasons.join(" · ")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Spectator: show draft complete message */}
      {isSpectating && isComplete && (
        <div className="mt-4">
          <div className="lol-card p-6 text-center">
            <p className="text-base font-bold text-[var(--ocaso-success)]">
              ✅ Draft completado
            </p>
            <p className="text-[11px] text-[var(--ocaso-text-muted)] mt-1">
              El draft ha finalizado. Revisa las composiciones disponibles.
            </p>
          </div>
        </div>
      )}

      {/* Creator: draft complete message */}
      {!isSpectating && isComplete && (
        <div className="mt-4">
          <div className="lol-card p-6 text-center">
            <p className="text-base font-bold text-[var(--ocaso-success)]">
              ✅ Draft completado
            </p>
            <p className="text-[11px] text-[var(--ocaso-text-muted)] mt-1">
              La simulación ha finalizado. Revisa las composiciones disponibles
              para ver el resultado.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
