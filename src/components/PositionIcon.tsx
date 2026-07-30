import React from "react";

interface PositionIconProps {
  role: string;
  size?: number;
  className?: string;
}

// SVG role icons diseñados al estilo del cliente de League of Legends
// Inspirados en los position icons oficiales

function TopIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      {/* Círculo de fondo tipo LoL */}
      <circle cx="24" cy="24" r="22" stroke="#C89B3C" strokeWidth="1.5" opacity="0.3" />
      <circle cx="24" cy="24" r="18" stroke="#C89B3C" strokeWidth="1" opacity="0.15" />
      {/* Casco/armadura - Top lane icon */}
      <path d="M16 28 C16 20, 20 16, 24 14 C28 16, 32 20, 32 28 L32 30 C32 32, 28 34, 24 34 C20 34, 16 32, 16 30 Z" stroke="#C89B3C" strokeWidth="1.8" fill="none" />
      <path d="M20 28 L24 18 L28 28" stroke="#C89B3C" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="18" y1="32" x2="30" y2="32" stroke="#C89B3C" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

function JungleIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="22" stroke="#C89B3C" strokeWidth="1.5" opacity="0.3" />
      <circle cx="24" cy="24" r="18" stroke="#C89B3C" strokeWidth="1" opacity="0.15" />
      {/* Garra/talon - Jungle icon */}
      <path d="M16 28 C14 24, 16 18, 20 16 L24 14 L28 16 C32 18, 34 24, 32 28 C30 32, 26 34, 24 34 C22 34, 18 32, 16 28 Z" stroke="#C89B3C" strokeWidth="1.8" fill="none" />
      <path d="M18 26 L20 30" stroke="#C89B3C" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M24 34 L24 30" stroke="#C89B3C" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M30 26 L28 30" stroke="#C89B3C" strokeWidth="1.5" strokeLinecap="round" />
      {/* Paw pads */}
      <circle cx="20" cy="22" r="2" stroke="#C89B3C" strokeWidth="1" fill="none" />
      <circle cx="24" cy="20" r="2" stroke="#C89B3C" strokeWidth="1" fill="none" />
      <circle cx="28" cy="22" r="2" stroke="#C89B3C" strokeWidth="1" fill="none" />
    </svg>
  );
}

function MidIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="22" stroke="#C89B3C" strokeWidth="1.5" opacity="0.3" />
      <circle cx="24" cy="24" r="18" stroke="#C89B3C" strokeWidth="1" opacity="0.15" />
      {/* Espadas cruzadas - Mid icon */}
      <path d="M24 14 L24 34" stroke="#C89B3C" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16 18 L32 30" stroke="#C89B3C" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
      <path d="M32 18 L16 30" stroke="#C89B3C" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
      {/* Guarda de la espada */}
      <path d="M18 20 L20 24 L24 24" stroke="#C89B3C" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M30 20 L28 24 L24 24" stroke="#C89B3C" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* Gemas decorativas */}
      <circle cx="24" cy="14" r="2" fill="#C89B3C" opacity="0.4" />
      <circle cx="24" cy="34" r="2" fill="#C89B3C" opacity="0.4" />
    </svg>
  );
}

function AdcIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="22" stroke="#C89B3C" strokeWidth="1.5" opacity="0.3" />
      <circle cx="24" cy="24" r="18" stroke="#C89B3C" strokeWidth="1" opacity="0.15" />
      {/* Arco y flecha / Crosshair - ADC icon */}
      <path d="M14 24 C14 18, 18 14, 24 14 C30 14, 34 18, 34 24" stroke="#C89B3C" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <line x1="24" y1="14" x2="24" y2="34" stroke="#C89B3C" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
      <line x1="14" y1="24" x2="34" y2="24" stroke="#C89B3C" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
      {/* Punta de flecha */}
      <path d="M28 20 L34 18 L32 24" stroke="#C89B3C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Crosshair center */}
      <circle cx="24" cy="24" r="4" stroke="#C89B3C" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

function SupportIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="22" stroke="#C89B3C" strokeWidth="1.5" opacity="0.3" />
      <circle cx="24" cy="24" r="18" stroke="#C89B3C" strokeWidth="1" opacity="0.15" />
      {/* Escudo - Support icon */}
      <path d="M16 16 L24 12 L32 16 L32 26 C32 32, 24 36, 24 36 C24 36, 16 32, 16 26 Z" stroke="#C89B3C" strokeWidth="1.8" fill="none" strokeLinejoin="round" />
      {/* Cross en el escudo */}
      <line x1="24" y1="18" x2="24" y2="30" stroke="#C89B3C" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="18" y1="24" x2="30" y2="24" stroke="#C89B3C" strokeWidth="1.5" strokeLinecap="round" />
      {/* Gemas decorativas */}
      <circle cx="24" cy="18" r="1.5" fill="#C89B3C" opacity="0.4" />
      <circle cx="24" cy="30" r="1.5" fill="#C89B3C" opacity="0.4" />
    </svg>
  );
}

const ICONS: Record<string, (s: number) => React.ReactNode> = {
  top: (s) => <TopIcon size={s} />,
  jungle: (s) => <JungleIcon size={s} />,
  mid: (s) => <MidIcon size={s} />,
  adc: (s) => <AdcIcon size={s} />,
  bottom: (s) => <AdcIcon size={s} />,
  support: (s) => <SupportIcon size={s} />,
  utility: (s) => <SupportIcon size={s} />,
};

export default function PositionIcon({ role, size = 32, className = "" }: PositionIconProps) {
  const icon = ICONS[role.toLowerCase()];
  if (!icon) return null;
  return <span className={className}>{icon(size)}</span>;
}

export const roleLabels: Record<string, string> = {
  top: "Top",
  jungle: "Jungla",
  mid: "Mid",
  adc: "ADC",
  bottom: "ADC",
  support: "Soporte",
  utility: "Soporte",
};
