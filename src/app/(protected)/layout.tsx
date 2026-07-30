"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("lolteam_token");
    if (!token) router.push("/");
    else setOk(true);
  }, [router]);

  if (!ok) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--ocaso-bg)]">
        <svg width="32" height="32" viewBox="0 0 48 48" fill="none" className="animate-pulse">
          <circle cx="24" cy="24" r="22" stroke="#7C3AED" strokeWidth="2" opacity="0.4" />
          <circle cx="24" cy="24" r="16" stroke="#22D3EE" strokeWidth="1.5" opacity="0.3" />
          <path d="M16 16 C24 12, 32 18, 30 28 C28 38, 18 34, 16 24 C14 14, 16 16, 16 16 Z"
            fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--ocaso-bg)]">
      <NavBar />
      <main>{children}</main>
    </div>
  );
}
