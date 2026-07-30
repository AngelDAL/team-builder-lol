"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { OcasoLogo } from "@/components/OcasoIcons";

export default function LoginPage() {
  const router = useRouter();
  const [summonerName, setSummonerName] = useState("");
  const [tag, setTag] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // Auto-login with saved token
  useEffect(() => {
    const token = localStorage.getItem("lolteam_token");
    if (token) {
      fetch("/api/users", { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => { if (r.ok) router.push("/dashboard"); else setLoading(false); })
        .catch(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const name = summonerName.trim();
    const tagVal = tag.trim().toUpperCase();

    if (!name || !tagVal) {
      setError("Completa los dos campos");
      setLoading(false);
      return;
    }

    try {
      // Single endpoint handles both login and register
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summonerName: name, tag: tagVal }),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.error); setLoading(false); return; }

      localStorage.setItem("lolteam_token", data.token);
      localStorage.setItem("lolteam_user", JSON.stringify(data.user));

      // Try to fetch profile icon in background
      fetch("/api/users/refresh-icon", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.token}` },
        body: JSON.stringify({ summonerName: name, tag: tagVal }),
      }).then(r => r.json()).then(d => {
        if (d.profileIconId) {
          const u = JSON.parse(localStorage.getItem("lolteam_user") || "{}");
          u.profileIconId = d.profileIconId;
          localStorage.setItem("lolteam_user", JSON.stringify(u));
        }
      }).catch(() => {});

      router.push("/dashboard");
    } catch {
      setError("Error de conexión");
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--ocaso-bg)]">
        <div className="animate-pulse">
          <OcasoLogo size={48} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--ocaso-bg)]">
      <div className="w-full max-w-sm">
        {/* Logo + Título */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-4">
            <OcasoLogo size={64} />
          </div>
          <h1 className="text-xl font-bold text-[var(--ocaso-purple-light)] tracking-widest uppercase">
            Team Ocaso
          </h1>
          <p className="text-xs text-[var(--ocaso-text-muted)] mt-1.5">
            Organiza las composiciones de tu equipo
          </p>
        </div>

        <div className="bg-[var(--ocaso-card)] border border-[var(--ocaso-card-border)] rounded-2xl p-6">
          {error && (
            <div className="bg-red-900/20 border border-red-800/30 text-red-400 text-xs px-3 py-2 rounded-xl mb-4 text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] text-[var(--ocaso-text-muted)] mb-1.5 uppercase tracking-wider font-semibold">
                Tu Riot ID
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={summonerName}
                  onChange={(e) => setSummonerName(e.target.value)}
                  className="input-ocaso flex-1 px-3 py-2.5 text-sm min-w-0"
                  placeholder="Nombre"
                  required
                />
                <div className="flex items-center text-[var(--ocaso-text-muted)] text-sm font-bold shrink-0">#</div>
                <input
                  type="text"
                  value={tag}
                  onChange={(e) => setTag(e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase())}
                  className="input-ocaso w-24 px-3 py-2.5 text-sm text-center uppercase"
                  placeholder="TAG"
                  maxLength={5}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-ocaso w-full py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              {loading ? "Entrando..." : "Entrar al equipo"}
            </button>
          </form>

          <p className="text-[10px] text-[var(--ocaso-text-muted)]/60 text-center mt-4 leading-relaxed">
            Ingresa tu Riot ID. Si el usuario no existe, se crea uno nuevo automáticamente.
          </p>
        </div>
      </div>
    </div>
  );
}
