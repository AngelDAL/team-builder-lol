"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { OcasoLogo, IconLogout } from "./OcasoIcons";

interface User {
  id: number;
  summonerName: string;
  tag: string;
  displayName: string;
  profileIconId?: number;
}

function readUser(): User | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem("lolteam_user");
  return stored ? JSON.parse(stored) : null;
}

function AvatarDisplay({ user, size = 30 }: { user: User; size?: number }) {
  const [imgFailed, setImgFailed] = useState(false);

  if (user.profileIconId && !imgFailed) {
    return (
      <img
        src={`/api/assets/profile-icon/${user.profileIconId}.png`}
        alt=""
        className="rounded-full border-2 border-[var(--ocaso-purple)]/50 object-cover shrink-0"
        style={{ width: size, height: size }}
        onError={() => setImgFailed(true)}
      />
    );
  }

  const initial = user.summonerName.charAt(0).toUpperCase();
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className="shrink-0">
      <circle cx="16" cy="16" r="15" fill="url(#nav-avatar)" stroke="#7C3AED" strokeWidth="1.5" />
      <defs>
        <linearGradient id="nav-avatar" x1="0" y1="0" x2="32" y2="32">
          <stop offset="0%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#22D3EE" />
        </linearGradient>
      </defs>
      <text x="16" y="16" textAnchor="middle" dominantBaseline="central"
        fill="#fff" fontSize="14" fontWeight="700" fontFamily="system-ui">
        {initial}
      </text>
    </svg>
  );
}

function HamburgerIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
}

function CloseIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}

export default function NavBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setUser(readUser());
  }, []);

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const handleLogout = () => {
    localStorage.removeItem("lolteam_token");
    localStorage.removeItem("lolteam_user");
    setDrawerOpen(false);
    router.push("/");
  };

  const navLinks = [
    { href: "/dashboard", label: "Panel" },
    { href: "/champions", label: "Picks" },
    { href: "/compositions", label: "Compos" },
    { href: "/compositions/new", label: "Nueva" },
    { href: "/simulador", label: "Simular" },
  ];

  return (
    <>
      <nav className="bg-[var(--ocaso-bg-alt)]/90 backdrop-blur-md border-b border-[var(--ocaso-card-border)] px-3 sm:px-6 py-2 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2 sm:gap-6">
          {/* Hamburger — solo móvil */}
          <button onClick={() => setDrawerOpen(true)}
            className="md:hidden p-2 -ml-1 rounded-lg text-[var(--ocaso-text-muted)] hover:text-[var(--ocaso-text)] hover:bg-[var(--ocaso-card-border)]/50 transition-all"
            aria-label="Abrir menú">
            <HamburgerIcon size={20} />
          </button>

          <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
            <OcasoLogo size={30} />
            <span className="hidden sm:inline text-[var(--ocaso-purple-light)] font-bold text-xs tracking-widest uppercase">
              Team Ocaso
            </span>
          </Link>

          {/* Nav links — solo desktop */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  pathname === link.href
                    ? "text-[var(--ocaso-cyan)] bg-[var(--ocaso-purple-glow)]"
                    : "text-[var(--ocaso-text-muted)] hover:text-[var(--ocaso-text)] hover:bg-[var(--ocaso-card-border)]/50"
                }`}>
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {user && (
            <div className="flex items-center gap-2">
              <AvatarDisplay user={user} size={30} />
              <span className="text-[11px] hidden sm:inline">
                <span className="text-[var(--ocaso-text)]">{user.summonerName}</span>
                <span className="text-[var(--ocaso-cyan)]">#{user.tag}</span>
              </span>
              <button onClick={handleLogout}
                className="flex items-center gap-1 text-[10px] px-2 py-1.5 rounded-lg border border-[var(--ocaso-card-border)] text-[var(--ocaso-text-muted)] hover:border-[var(--ocaso-danger)]/50 hover:text-[var(--ocaso-danger)] transition-colors ml-1">
                <IconLogout size={12} />
                <span className="hidden sm:inline">Salir</span>
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Drawer móvil */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)} />

          {/* Drawer panel */}
          <div className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-[var(--ocaso-bg-alt)] border-r border-[var(--ocaso-card-border)] animate-slide-left flex flex-col shadow-2xl">

            {/* Drawer header: user info */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--ocaso-card-border)]">
              {user ? (
                <div className="flex items-center gap-2.5 min-w-0">
                  <AvatarDisplay user={user} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{user.summonerName}</p>
                    <p className="text-[10px] text-[var(--ocaso-text-muted)]">
                      <span className="text-[var(--ocaso-cyan)]">#{user.tag}</span>
                    </p>
                  </div>
                </div>
              ) : (
                <span className="text-xs text-[var(--ocaso-text-muted)]">Menú</span>
              )}
              <button onClick={() => setDrawerOpen(false)}
                className="p-1.5 rounded-lg text-[var(--ocaso-text-muted)] hover:text-white hover:bg-[var(--ocaso-card-border)]/50 transition-all">
                <CloseIcon size={18} />
              </button>
            </div>

            {/* Drawer nav links */}
            <div className="flex-1 p-3 space-y-1 overflow-y-auto">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    pathname === link.href
                      ? "text-[var(--ocaso-cyan)] bg-[var(--ocaso-purple-glow)] border border-[var(--ocaso-purple)]/20"
                      : "text-[var(--ocaso-text-muted)] hover:text-[var(--ocaso-text)] hover:bg-[var(--ocaso-card-border)]/50"
                  }`}>
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Drawer footer: logout */}
            <div className="p-3 border-t border-[var(--ocaso-card-border)]">
              <button onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 text-xs px-3 py-2.5 rounded-lg border border-[var(--ocaso-card-border)] text-[var(--ocaso-text-muted)] hover:border-[var(--ocaso-danger)]/50 hover:text-[var(--ocaso-danger)] transition-colors">
                <IconLogout size={14} />
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
