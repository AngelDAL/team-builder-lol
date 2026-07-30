"use client";

import { useState } from "react";

interface Champion {
  id: number;
  championId: number;
  name: string;
  title: string;
  imageUrl: string;
}

interface ChampionSearchProps {
  champions: Champion[];
  selectedIds: Set<number>;
  onToggle: (championId: number) => void;
  loading?: boolean;
  saving?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
  /** When true, shows a progress bar with count */
  showProgress?: boolean;
  /** Extra class names for the wrapper */
  className?: string;
}

function LoadingShimmerGrid() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="loading-shimmer h-8 w-full" />
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-1.5">
        {Array.from({ length: 24 }).map((_, i) => (
          <div key={i} className="loading-shimmer aspect-square rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="text-center text-xs text-[var(--ocaso-text-muted)] py-8">
      {message}
    </p>
  );
}

export default function ChampionSearch({
  champions,
  selectedIds,
  onToggle,
  loading = false,
  saving = false,
  searchPlaceholder = "Buscar campeón...",
  emptyMessage = "Sin resultados",
  showProgress = false,
  className = "",
}: ChampionSearchProps) {
  const [search, setSearch] = useState("");

  if (loading) {
    return <LoadingShimmerGrid />;
  }

  const filtered = champions.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()),
  );

  const progress =
    showProgress && champions.length > 0
      ? (selectedIds.size / champions.length) * 100
      : 0;

  return (
    <div className={`animate-fade-in ${className}`}>
      {/* Progress bar */}
      {showProgress && champions.length > 0 && (
        <div className="space-y-1 mb-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--ocaso-text-muted)]">
              {selectedIds.size} de {champions.length}
            </span>
          </div>
          <div className="w-full bg-[var(--ocaso-bg)] rounded-full h-1.5 border border-[var(--ocaso-card-border)]">
            <div
              className="bg-gradient-to-r from-[var(--ocaso-purple-dark)] via-[var(--ocaso-purple)] to-[var(--ocaso-cyan)] h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Search input */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="input-ocaso w-full px-4 py-2.5 text-sm mb-4"
        placeholder={searchPlaceholder}
      />

      {/* No results */}
      {filtered.length === 0 && <EmptyState message={emptyMessage} />}

      {/* Champion grid */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-1.5">
          {filtered.map((champ) => {
            const selected = selectedIds.has(champ.id);
            return (
              <button
                key={champ.id}
                onClick={() => onToggle(champ.id)}
                disabled={saving}
                className={`relative rounded-xl p-1.5 text-center transition-all ${
                  selected
                    ? "selected-ocaso"
                    : "lol-card hover:border-[var(--ocaso-card-border)]/50"
                }`}
              >
                <img
                  src={champ.imageUrl}
                  alt={champ.name}
                  className={`w-full aspect-square object-contain mb-0.5 rounded-lg transition-all ${
                    selected
                      ? "opacity-100"
                      : "opacity-50 grayscale hover:grayscale-0 hover:opacity-80"
                  }`}
                />
                <p
                  className={`text-[9px] leading-tight truncate ${
                    selected
                      ? "text-[var(--ocaso-purple-light)] font-semibold"
                      : "text-[var(--ocaso-text-muted)]"
                  }`}
                >
                  {champ.name}
                </p>
                {selected && (
                  <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-[var(--ocaso-purple)] rounded-full flex items-center justify-center">
                    <svg
                      width="8"
                      height="8"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#fff"
                      strokeWidth="4"
                    >
                      <polyline
                        points="20 6 9 17 4 12"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Re-export Champion type for convenience */
export type { Champion };
