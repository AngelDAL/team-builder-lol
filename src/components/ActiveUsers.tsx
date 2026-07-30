"use client";

import useWebSocket from "@/hooks/useWebSocket";
import { useRouter } from "next/navigation";
import { getRoleLabel } from "./OcasoIcons";

interface ActiveUsersProps {
  /** userId → activity/status text shown in tooltip (e.g. "En Mi Comp") */
  userActivity?: Record<number, string>;
  /** userId → primaryRole slug (shown as label in tooltip) */
  userRoles?: Record<number, string>;
  /** userId → compositionId (makes activity clickable → /compositions/[id]) */
  userCompositionLinks?: Record<number, number>;
}

const MAX_VISIBLE = 5;

// ─── Circular avatar SVG with gradient initial ───
function AvatarSVG({ initial, userId, size = 34 }: { initial: string; userId: number; size?: number }) {
  const letter = initial.charAt(0).toUpperCase();
  const gradId = `active-user-grad-${userId}`;
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" fill="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="34" y2="34">
          <stop offset="0%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#22D3EE" />
        </linearGradient>
      </defs>
      <circle cx="17" cy="17" r="15.5" fill={`url(#${gradId})`} />
      <text
        x="17" y="17" textAnchor="middle" dominantBaseline="central"
        fill="#fff" fontSize="14" fontWeight="700" fontFamily="system-ui, sans-serif"
      >
        {letter}
      </text>
    </svg>
  );
}

// ─── Animated online ring ───
function OnlineRing({ userId }: { userId: number }) {
  const animId = `online-pulse-${userId}`;
  return (
    <svg
      width={38} height={38} viewBox="0 0 38 38" fill="none"
      className="absolute -inset-[2px] pointer-events-none"
    >
      <circle
        cx="19" cy="19" r="18" stroke="#22D3EE" strokeWidth="1.5" opacity="0.5"
      >
        <animate
          attributeName="r" values="18;20;18" dur="2s" repeatCount="indefinite"
        />
        <animate
          attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite"
        />
      </circle>
    </svg>
  );
}

// ─── Overflow "+N" badge ───
function OverflowBadge({ count }: { count: number }) {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
      <circle cx="17" cy="17" r="15" fill="var(--ocaso-card)" stroke="var(--ocaso-card-border)" strokeWidth="1.5" />
      <text
        x="17" y="17" textAnchor="middle" dominantBaseline="central"
        fill="var(--ocaso-text-muted)" fontSize="10" fontWeight="600" fontFamily="system-ui, sans-serif"
      >
        +{count}
      </text>
    </svg>
  );
}

// ─── Tooltip card ───
function UserTooltip({
  summonerName,
  tag,
  role,
  activity,
  hasLink,
}: {
  summonerName: string;
  tag: string;
  role?: string;
  activity?: string;
  hasLink: boolean;
}) {
  return (
    <div
      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5
                 opacity-0 group-hover:opacity-100
                 transition-opacity duration-200 pointer-events-none
                 z-50 min-w-[140px]"
    >
      <div className="bg-[var(--ocaso-card)] border border-[var(--ocaso-card-border)]
                      rounded-xl px-3 py-2 shadow-xl shadow-black/30">
        {/* summonerName#tag */}
        <p className="text-[11px] font-semibold text-[var(--ocaso-text)] whitespace-nowrap leading-tight">
          {summonerName}
          <span className="text-[var(--ocaso-cyan)]">#{tag}</span>
        </p>

        {/* primaryRole */}
        {role && (
          <p className="text-[10px] text-[var(--ocaso-text-muted)] mt-0.5">
            {getRoleLabel(role)}
          </p>
        )}

        {/* activity / estado */}
        {activity && (
          <p
            className={`text-[10px] mt-0.5 flex items-center gap-1 ${
              hasLink
                ? "text-[var(--ocaso-purple-light)] cursor-pointer hover:underline"
                : "text-[var(--ocaso-text-muted)]"
            }`}
          >
            {hasLink && (
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            )}
            <span>{activity}</span>
          </p>
        )}
      </div>
      {/* Tooltip arrow */}
      <div className="w-2 h-2 bg-[var(--ocaso-card)] border-r border-b border-[var(--ocaso-card-border)]
                      rotate-45 absolute left-1/2 -translate-x-1/2 -bottom-1" />
    </div>
  );
}

// ─── Main component ───
export default function ActiveUsers({
  userActivity,
  userRoles,
  userCompositionLinks,
}: ActiveUsersProps) {
  const { onlineUsers, connected } = useWebSocket();
  const router = useRouter();

  // While connecting with no users: minimal pulse dot only
  if (!connected && onlineUsers.length === 0) {
    return (
      <div className="flex items-center justify-center w-8 h-8">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--ocaso-cyan)] opacity-40" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--ocaso-cyan)] opacity-70" />
        </span>
      </div>
    );
  }

  const visible = onlineUsers.slice(0, MAX_VISIBLE);
  const extra = onlineUsers.length - MAX_VISIBLE;

  return (
    <div className="flex items-center -space-x-1.5">
      {visible.map((u, i) => {
        const role = userRoles?.[u.userId];
        const activity = userActivity?.[u.userId];
        const compId = userCompositionLinks?.[u.userId];
        const hasLink = !!compId && !!activity;

        return (
          <div
            key={u.userId}
            className="relative group"
            style={{ zIndex: visible.length - i }}
          >
            {/* Clickable area: avatar + ring */}
            <button
              type="button"
              onClick={hasLink ? () => router.push(`/compositions/${compId}`) : undefined}
              className={`relative block outline-none ${
                hasLink ? "cursor-pointer" : "cursor-default"
              }`}
              aria-label={`${u.summonerName}#${u.tag}${role ? ` — ${getRoleLabel(role)}` : ""}`}
            >
              {/* Animated cyan ring (online indicator) */}
              {connected && <OnlineRing userId={u.userId} />}
              {/* Avatar */}
              <div className="relative">
                <AvatarSVG initial={u.summonerName} userId={u.userId} size={34} />
              </div>
            </button>

            {/* Tooltip on hover */}
            <UserTooltip
              summonerName={u.summonerName}
              tag={u.tag}
              role={role}
              activity={activity}
              hasLink={hasLink}
            />
          </div>
        );
      })}

      {/* +N overflow badge */}
      {extra > 0 && (
        <div className="relative" style={{ zIndex: 0 }}>
          <OverflowBadge count={extra} />
        </div>
      )}
    </div>
  );
}
