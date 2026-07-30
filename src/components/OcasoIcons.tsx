"use client";

import React from "react";

// ─── Brand ───
export function OcasoLogo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <defs>
        <linearGradient id="ml" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#22D3EE" />
        </linearGradient>
      </defs>
      {/* Círculo exterior (resplandor) */}
      <circle cx="24" cy="24" r="22" stroke="#7C3AED" strokeWidth="1.5" opacity="0.25" />
      {/* Luna llena */}
      <circle cx="24" cy="24" r="12" fill="url(#ml)" opacity="0.15" />
      <circle cx="24" cy="24" r="12" stroke="#A78BFA" strokeWidth="1.5" />
      {/* Sombra de luna (creciente) */}
      <path d="M30 14 C36 18, 36 30, 30 34 C32 30, 32 18, 30 14 Z" fill="#0a0a0f" />
      {/* Cráteres sutiles */}
      <circle cx="20" cy="20" r="2" stroke="#22D3EE" strokeWidth="0.8" opacity="0.25" />
      <circle cx="27" cy="27" r="1.5" stroke="#22D3EE" strokeWidth="0.8" opacity="0.2" />
      <circle cx="19" cy="29" r="1" stroke="#22D3EE" strokeWidth="0.8" opacity="0.15" />
      {/* Estrellas */}
      <circle cx="10" cy="12" r="1" fill="#A78BFA" opacity="0.6" />
      <circle cx="38" cy="16" r="1" fill="#A78BFA" opacity="0.4" />
      <circle cx="35" cy="36" r="0.8" fill="#A78BFA" opacity="0.3" />
      <circle cx="12" cy="34" r="0.8" fill="#A78BFA" opacity="0.5" />
    </svg>
  );
}

// ─── Roles (position icons) ───
export function RoleTop({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path d="M16 6 L16 26" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
      <path d="M8 16 L24 16" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
      {/* Casco */}
      <path d="M10 18 C10 12, 14 8, 16 8 C18 8, 22 12, 22 18 L22 22 C22 24, 20 26, 16 26 C12 26, 10 24, 10 22 Z"
        stroke="#A78BFA" strokeWidth="1.8" fill="none" />
      <path d="M13 18 L16 10 L19 18" stroke="#A78BFA" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16" cy="14" r="1.5" fill="#22D3EE" opacity="0.5" />
    </svg>
  );
}

export function RoleJungle({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path d="M16 6 L16 26" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
      <path d="M8 16 L24 16" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
      {/* Garra */}
      <path d="M10 18 C8 14, 12 8, 16 8 L20 8 C24 8, 22 14, 22 18 C22 24, 18 26, 16 26 C14 26, 10 24, 10 18 Z"
        stroke="#A78BFA" strokeWidth="1.8" fill="none" />
      <circle cx="14" cy="16" r="2" stroke="#22D3EE" strokeWidth="1" fill="none" />
      <circle cx="18" cy="16" r="2" stroke="#22D3EE" strokeWidth="1" fill="none" />
      <circle cx="16" cy="20" r="2" stroke="#22D3EE" strokeWidth="1" fill="none" />
    </svg>
  );
}

export function RoleMid({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path d="M16 6 L16 26" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
      <path d="M8 16 L24 16" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
      {/* Espada */}
      <line x1="16" y1="8" x2="16" y2="24" stroke="#A78BFA" strokeWidth="2" strokeLinecap="round" />
      <path d="M10 14 L22 18" stroke="#A78BFA" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
      <path d="M22 14 L10 18" stroke="#A78BFA" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
      <circle cx="16" cy="8" r="2" fill="#22D3EE" opacity="0.5" />
      <circle cx="16" cy="24" r="2" fill="#22D3EE" opacity="0.5" />
    </svg>
  );
}

export function RoleAdc({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path d="M16 6 L16 26" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
      <path d="M8 16 L24 16" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
      {/* Crosshair / Mira */}
      <circle cx="16" cy="16" r="7" stroke="#A78BFA" strokeWidth="1.8" fill="none" />
      <line x1="16" y1="9" x2="16" y2="23" stroke="#A78BFA" strokeWidth="1.2" opacity="0.6" />
      <line x1="9" y1="16" x2="23" y2="16" stroke="#A78BFA" strokeWidth="1.2" opacity="0.6" />
      <circle cx="16" cy="16" r="2" fill="#22D3EE" opacity="0.7" />
      {/* Punta de flecha */}
      <path d="M20 12 L26 10 L24 16" stroke="#A78BFA" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function RoleSupport({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path d="M16 6 L16 26" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
      <path d="M8 16 L24 16" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
      {/* Escudo */}
      <path d="M10 12 L16 8 L22 12 L22 18 C22 24, 16 26, 16 26 C16 26, 10 24, 10 18 Z"
        stroke="#A78BFA" strokeWidth="1.8" fill="none" strokeLinejoin="round" />
      <line x1="16" y1="12" x2="16" y2="22" stroke="#A78BFA" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="11" y1="17" x2="21" y2="17" stroke="#A78BFA" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="16" cy="12" r="1.5" fill="#22D3EE" opacity="0.5" />
    </svg>
  );
}

// ─── Misc UI icons ───
export function IconUsers({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="1.8">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function IconComposition({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="1.8">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

export function IconChampion({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="1.8">
      <path d="M12 2 L15 9 L22 9 L16 14 L18 21 L12 17 L6 21 L8 14 L2 9 L9 9 Z" />
    </svg>
  );
}

export function IconOnline({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" fill="none">
      <circle cx="5" cy="5" r="4" fill="#22D3EE" opacity="0.8" />
      <circle cx="5" cy="5" r="4" fill="none" stroke="#22D3EE" strokeWidth="1" opacity="0.4">
        <animate attributeName="r" values="4;6;4" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

export function IconAdd({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" strokeLinecap="round" />
      <line x1="5" y1="12" x2="19" y2="12" strokeLinecap="round" />
    </svg>
  );
}

export function IconDelete({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#E84057" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" strokeLinecap="round" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

export function IconBack({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2">
      <line x1="19" y1="12" x2="5" y2="12" strokeLinecap="round" />
      <polyline points="12 19 5 12 12 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconLogout({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeLinecap="round" />
      <polyline points="16 17 21 12 16 7" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="21" y1="12" x2="9" y2="12" strokeLinecap="round" />
    </svg>
  );
}

export function IconChevronRight({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2.5">
      <polyline points="9 18 15 12 9 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Role icon resolver ───
export const ROLE_ICONS: Record<string, React.FC<{ size?: number }>> = {
  top: RoleTop,
  jungle: RoleJungle,
  mid: RoleMid,
  adc: RoleAdc,
  bottom: RoleAdc,
  support: RoleSupport,
  utility: RoleSupport,
};

export const ROLE_LABELS: Record<string, string> = {
  top: "Top",
  jungle: "Jungla",
  mid: "Mid",
  adc: "ADC",
  bottom: "ADC",
  support: "Soporte",
  utility: "Soporte",
};

export function getRoleIcon(role: string, size = 28) {
  const Icon = ROLE_ICONS[role.toLowerCase()];
  if (!Icon) return null;
  return <Icon size={size} />;
}

export function getRoleLabel(role: string) {
  return ROLE_LABELS[role.toLowerCase()] || role;
}
