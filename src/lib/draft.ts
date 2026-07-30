// ─── Draft Step Definitions ───

export type DraftSide = "blue" | "red";
export type DraftAction = "ban" | "pick";

export interface DraftStep {
  action: DraftAction;
  side: DraftSide;
  label: string;
}

/**
 * Full draft sequence matching the described format:
 * Phase 1 Bans: 3 Blue, 3 Red (alternating, Blue starts)
 * Phase 1 Picks: Blue 1, Red 2, Blue 2, Red 1
 * Phase 2 Bans: Red 2, Blue 2
 * Phase 2 Picks: Red 1, Blue 2, Red 1
 *
 * Each entry = one champion selection (`count` always 1 for our step model).
 */
export const DRAFT_STEPS: DraftStep[] = [
  // ── Phase 1 Bans (6 steps) ──
  { action: "ban", side: "blue", label: "Baneo Azul #1" },
  { action: "ban", side: "red", label: "Baneo Rojo #1" },
  { action: "ban", side: "blue", label: "Baneo Azul #2" },
  { action: "ban", side: "red", label: "Baneo Rojo #2" },
  { action: "ban", side: "blue", label: "Baneo Azul #3" },
  { action: "ban", side: "red", label: "Baneo Rojo #3" },

  // ── Phase 1 Picks (6 steps) ──
  { action: "pick", side: "blue", label: "Pick Azul #1" },
  { action: "pick", side: "red", label: "Pick Rojo #1" },
  { action: "pick", side: "red", label: "Pick Rojo #2" },
  { action: "pick", side: "blue", label: "Pick Azul #2" },
  { action: "pick", side: "blue", label: "Pick Azul #3" },
  { action: "pick", side: "red", label: "Pick Rojo #3" },

  // ── Phase 2 Bans (4 steps) ──
  { action: "ban", side: "red", label: "Baneo Rojo #4" },
  { action: "ban", side: "blue", label: "Baneo Azul #4" },
  { action: "ban", side: "red", label: "Baneo Rojo #5" },
  { action: "ban", side: "blue", label: "Baneo Azul #5" },

  // ── Phase 2 Picks (4 steps) ──
  { action: "pick", side: "red", label: "Pick Rojo #4" },
  { action: "pick", side: "blue", label: "Pick Azul #4" },
  { action: "pick", side: "blue", label: "Pick Azul #5" },
  { action: "pick", side: "red", label: "Pick Rojo #5" },
];

// ─── Phase boundaries (for visual grouping) ───
export const PHASES = [
  { name: "Fase 1 - Bans", start: 0, end: 5 },
  { name: "Fase 1 - Picks", start: 6, end: 11 },
  { name: "Fase 2 - Bans", start: 12, end: 15 },
  { name: "Fase 2 - Picks", start: 16, end: 19 },
];

export const TOTAL_STEPS = DRAFT_STEPS.length; // 20

// ─── Draft State ───

export interface SlotInfo {
  championId: number;
  championName: string;
  imageUrl: string;
  role: string;
}

export interface DraftState {
  /** Which side "we" are */
  side: DraftSide | null;
  /** Current step index (0-based) */
  currentStep: number;
  /** All banned champion IDs (by either side) */
  banned: number[];
  /** Champion IDs picked by blue team (in order) */
  bluePicks: number[];
  /** Champion IDs picked by red team (in order) */
  redPicks: number[];
}

export function createInitialState(): DraftState {
  return {
    side: null,
    currentStep: 0,
    banned: [],
    bluePicks: [],
    redPicks: [],
  };
}

// ─── Composition Filtering ───

export interface CompSlot {
  role: string;
  champion: { id: number; name: string; imageUrl: string };
  substitutes?: Array<{
    id: number;
    champion: { id: number; name: string; imageUrl: string };
    sortOrder: number;
  }>;
}

export interface Composition {
  id: number;
  name: string;
  description: string | null;
  slots: CompSlot[];
  creator: { summonerName: string; tag: string };
}

export interface FilteredSlot {
  role: string;
  activeChampion: { id: number; name: string; imageUrl: string };
  isSubstituted: boolean;
  substituteReason?: string;
}

export interface FilteredComp {
  id: number;
  name: string;
  description: string | null;
  slots: FilteredSlot[];
  creator: { summonerName: string; tag: string };
  /** Reasons this comp is dead (empty = alive) */
  deadReasons: string[];
}

/**
 * Filter compositions based on current draft state.
 *
 * For each slot, if the main champion is banned or enemy-picked, the function
 * iterates through substitutes (in sortOrder) to find one that's still available.
 * If a substitute is found, it's used as activeChampion with isSubstituted=true.
 * If no substitute is available, the composition is marked dead for that slot.
 *
 * The user's own picks are also verified: our picked champions must exist
 * somewhere (as main champion or as a substitute) in the composition.
 *
 * Returns each comp annotated with deadReasons[] (empty = alive) and
 * FilteredSlot[] where each slot carries the actually-played champion.
 */
export function filterCompositions(
  compositions: Composition[],
  state: DraftState,
  userSide: DraftSide
): FilteredComp[] {
  const bannedSet = new Set(state.banned);
  const enemySide = userSide === "blue" ? "red" : "blue";
  const enemyPicks = enemySide === "blue" ? state.bluePicks : state.redPicks;
  const enemySet = new Set(enemyPicks);
  // Our own picks — comps MUST include all of these to stay alive
  const ourPicks = userSide === "blue" ? state.bluePicks : state.redPicks;

  return compositions.map((comp) => {
    const reasons: string[] = [];

    const filteredSlots: FilteredSlot[] = comp.slots.map((slot) => {
      const mainId = slot.champion.id;
      let activeChamp = slot.champion;
      let isSubstituted = false;
      let substituteReason: string | undefined;

      // Check if main champion is banned or enemy-picked
      const mainBlocked = bannedSet.has(mainId) || enemySet.has(mainId);

      if (mainBlocked) {
        // Try substitutes in sortOrder
        const subs = slot.substitutes || [];
        let found = false;
        for (const sub of subs) {
          if (!bannedSet.has(sub.champion.id) && !enemySet.has(sub.champion.id)) {
            activeChamp = sub.champion;
            isSubstituted = true;
            substituteReason = bannedSet.has(mainId)
              ? `${slot.champion.name} baneado`
              : `${slot.champion.name} pickeado por enemigos`;
            found = true;
            break;
          }
        }
        if (!found) {
          // All substitutes also blocked — this slot is dead
          if (subs.length > 0) {
            reasons.push(`${slot.champion.name} y sus sustitutos no disponibles`);
          } else {
            reasons.push(
              bannedSet.has(mainId)
                ? `${slot.champion.name} baneado`
                : `${slot.champion.name} pickeado por enemigos`
            );
          }
        }
      }

      return {
        role: slot.role,
        activeChampion: activeChamp,
        isSubstituted,
        substituteReason,
      };
    });

    // Check that ALL our picks are present in this comp (main or substitute)
    for (const pickedId of ourPicks) {
      const isInComp = comp.slots.some(
        (slot) =>
          slot.champion.id === pickedId ||
          (slot.substitutes || []).some((sub) => sub.champion.id === pickedId)
      );
      if (!isInComp) {
        reasons.push(`Pick #${pickedId} no está en esta composición`);
        break;
      }
    }

    return {
      id: comp.id,
      name: comp.name,
      description: comp.description,
      slots: filteredSlots,
      creator: comp.creator,
      deadReasons: reasons,
    };
  });
}

/**
 * Get the current step info and whether the user needs to act.
 */
export function getCurrentStepInfo(
  state: DraftState
): { step: DraftStep; isOurTurn: boolean } | null {
  if (state.currentStep >= TOTAL_STEPS || !state.side) return null;
  const step = DRAFT_STEPS[state.currentStep];
  return {
    step,
    isOurTurn: step.side === state.side,
  };
}

/**
 * Get the phase label for a given step index.
 */
export function getPhaseLabel(stepIndex: number): string {
  for (const phase of PHASES) {
    if (stepIndex >= phase.start && stepIndex <= phase.end) {
      return phase.name;
    }
  }
  return "";
}
