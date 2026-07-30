"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Champ {
  id: number; name: string; imageUrl: string; tags: string;
}

interface UserInfo {
  id: number;
  summonerName: string;
  tag: string;
  profileIconId: number | null;
  primaryRole: string;
}

const ROLES = [
  { id: "top", label: "Top" },
  { id: "jungle", label: "Jungla" },
  { id: "mid", label: "Mid" },
  { id: "adc", label: "ADC" },
  { id: "support", label: "Soporte" },
];

const ROLE_SVGS: Record<string, string> = {
  top: "M12 2 L7 9 L10 9 L8 16 L12 13 L16 16 L14 9 L17 9 Z",
  jungle: "M12 2 C8 2, 4 6, 4 12 C4 16, 6 19, 12 22 C18 19, 20 16, 20 12 C20 6, 16 2, 12 2 Z M12 6 C14 6, 16 8, 16 12 C16 14, 14 16, 12 16 C10 16, 8 14, 8 12 C8 8, 10 6, 12 6 Z",
  mid: "M12 2 L22 12 L12 22 L2 12 Z M12 6 L18 12 L12 18 L6 12 Z",
  adc: "M12 2 C6 2, 2 6, 2 12 C2 18, 6 22, 12 22 C18 22, 22 18, 22 12 C22 6, 18 2, 12 2 Z M12 6 C15 6, 18 9, 18 12 C18 15, 15 18, 12 18 C9 18, 6 15, 6 12 C6 9, 9 6, 12 6 Z M12 8 L14 12 L12 16 L10 12 Z",
  support: "M12 2 L4 8 L4 16 C4 20, 8 22, 12 24 C16 22, 20 20, 20 16 L20 8 Z M8 12 L16 12 M12 8 L12 16",
};

const LANES = ["Todos", "Top", "Jungla", "Mid", "ADC", "Soporte"] as const;

const LANE_MAP: Record<string, string[]> = {
  Top: ["fighter", "tank"],
  Jungla: [],
  Mid: ["mage", "assassin"],
  ADC: ["marksman"],
  Soporte: ["support"],
};

const TAG_LABELS: Record<string, string> = {
  fighter: "Fighter",
  tank: "Tank",
  mage: "Mage",
  assassin: "Assassin",
  marksman: "Marksman",
  support: "Support",
  specialist: "Specialist",
};

const champMatchesLane = (champ: Champ, lane: string): boolean => {
  if (lane === "Todos" || !lane) return true;
  const tagList = (champ.tags || "").toLowerCase().split(",");
  const keywords = LANE_MAP[lane];
  if (!keywords || keywords.length === 0) return false;
  return keywords.some((kw) => tagList.includes(kw));
};

const PROFILE_ICON_BASE = "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons";

export default function PicksPage() {
  const router = useRouter();
  const [champs, setChamps] = useState<Champ[]>([]);
  const [myIds, setMyIds] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [lane, setLane] = useState("Todos");
  const [loading, setLoading] = useState(true);
  const [needsSeed, setNeedsSeed] = useState(false);
  const [role, setRole] = useState("");
  const [saving, setSaving] = useState(false);
  const [me, setMe] = useState<UserInfo | null>(null);
  const [syncing, setSyncing] = useState(false);

  const TOKEN = typeof window !== "undefined" ? localStorage.getItem("lolteam_token") : null;

  const api = async (url: string, opts?: RequestInit) => {
    const token = localStorage.getItem("lolteam_token");
    return fetch(url, { ...opts, headers: { ...opts?.headers, Authorization: `Bearer ${token}` } as any });
  };

  const loadAll = async () => {
    try {
      const [allRes, myRes, usersRes] = await Promise.all([
        api("/api/champions"),
        api("/api/user/champions"),
        api("/api/users"),
      ]);
      const all = await allRes.json();
      const my = await myRes.json();
      const users = await usersRes.json();

      if (!all.champions?.length) { setNeedsSeed(true); setLoading(false); return; }

      setChamps(all.champions);
      setMyIds(new Set((my.champions || []).map((c: Champ) => c.id)));

      // Set current user's role & profile data
      const stored = localStorage.getItem("lolteam_user");
      if (stored) {
        const u = JSON.parse(stored);
        const meData = (users.users || []).find((x: any) => x.id === u.id);
        if (meData) {
          setRole(meData.primaryRole || "");
          setMe({
            id: meData.id,
            summonerName: meData.summonerName,
            tag: meData.tag,
            profileIconId: meData.profileIconId,
            primaryRole: meData.primaryRole || "",
          });
        }
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!TOKEN) { router.push("/"); return; }
    loadAll();
  }, []);

  const toggle = async (id: number) => {
    setSaving(true);
    try {
      if (myIds.has(id)) {
        await api(`/api/user/champions?championId=${id}`, { method: "DELETE" });
        setMyIds(p => { const n = new Set(p); n.delete(id); return n; });
      } else {
        await api("/api/user/champions", { method: "POST", body: JSON.stringify({ championIds: [id] }) });
        setMyIds(p => new Set(p).add(id));
      }
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const setPrimaryRole = async (r: string) => {
    const newRole = role === r ? "" : r;
    try {
      await api("/api/users", { method: "PATCH", body: JSON.stringify({ primaryRole: newRole }) });
      setRole(newRole);
    } catch (e) { console.error(e); }
  };

  const seed = async () => {
    setLoading(true);
    await api("/api/champions/seed", { method: "POST" });
    await loadAll();
  };

  const refreshIcon = async () => {
    if (!me || syncing) return;
    setSyncing(true);
    try {
      const res = await api("/api/users/refresh-icon", {
        method: "POST",
        body: JSON.stringify({ summonerName: me.summonerName, tag: me.tag }),
      });
      const data = await res.json();
      if (data.profileIconId) {
        setMe(prev => prev ? { ...prev, profileIconId: data.profileIconId } : null);
      }
    } catch (e) { console.error(e); }
    finally { setSyncing(false); }
  };

  const q = search.toLowerCase();
  const filtered = champs.filter((c) => {
    if (q && !c.name.toLowerCase().includes(q)) return false;
    if (!champMatchesLane(c, lane)) return false;
    return true;
  });

  const profileIconUrl = me?.profileIconId
    ? `${PROFILE_ICON_BASE}/${me.profileIconId}.jpg`
    : null;

  const firstInitial = me?.summonerName
    ? me.summonerName.charAt(0).toUpperCase()
    : "?";

  if (loading) {
    return (
      <div className="max-w-lg mx-auto p-4 space-y-3">
        <div className="loading-shimmer h-8" />
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="loading-shimmer aspect-square rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (needsSeed) {
    return (
      <div className="max-w-lg mx-auto p-4 text-center py-16">
        <p className="text-sm text-[var(--ocaso-text-muted)] mb-4">Cargar campeones desde Riot API</p>
        <button onClick={seed} className="btn-ocaso px-5 py-2 text-sm">Cargar</button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-bold text-[var(--ocaso-text)]">Mis Picks</h1>
          <p className="text-[10px] text-[var(--ocaso-text-muted)]">{myIds.size} campeones</p>
        </div>
        {role && <span className="badge-ocaso">{ROLES.find(r => r.id === role)?.label}</span>}
      </div>

      {/* Summoner icon + Role selector row */}
      <div className="flex items-start gap-3">
        {/* Icono de invocador */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-[var(--ocaso-card-border)] bg-[var(--ocaso-card)] flex items-center justify-center">
            {profileIconUrl ? (
              <img
                src={profileIconUrl}
                alt={me?.summonerName || ""}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                  (e.target as HTMLImageElement).parentElement!.querySelector(".fallback-icon")?.classList.remove("hidden");
                }}
              />
            ) : null}
            <div className={`fallback-icon ${profileIconUrl ? "hidden" : ""} w-full h-full flex items-center justify-center bg-gradient-to-br from-[var(--ocaso-purple-dark)] to-[var(--ocaso-purple)]`}>
              <span className="text-sm font-bold text-white">{firstInitial}</span>
            </div>
          </div>
          <button
            onClick={refreshIcon}
            disabled={syncing}
            className="text-[9px] text-[var(--ocaso-cyan)] hover:text-[var(--ocaso-cyan)]/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-0.5"
            title="Sincronizar icono desde Riot"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={syncing ? "animate-spin" : ""}>
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
            </svg>
            Sincronizar
          </button>
        </div>

        {/* Role selector */}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-[var(--ocaso-text-muted)] uppercase tracking-wider font-semibold mb-2">
            L&iacute;nea principal
          </p>
          <div className="flex gap-2">
            {ROLES.map(r => {
              const sel = role === r.id;
              return (
                <button key={r.id} onClick={() => setPrimaryRole(r.id)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    sel
                      ? "bg-[var(--ocaso-purple-glow)] border-2 border-[var(--ocaso-purple)] shadow-[0_0_10px_rgba(124,58,237,0.3)]"
                      : "bg-[var(--ocaso-card)] border-2 border-[var(--ocaso-card-border)] hover:border-[var(--ocaso-purple)]/40"
                  }`}
                  title={r.label}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={sel ? "#A78BFA" : "#6b7280"} strokeWidth="1.5">
                    <path d={ROLE_SVGS[r.id]} />
                  </svg>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          className="input-ocaso w-full px-3 py-2 text-sm pl-8"
          placeholder="Buscar campe&oacute;n..." />
        <svg className="absolute left-2.5 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </div>

      {/* Lane filter pills */}
      <div>
        <p className="text-[10px] text-[var(--ocaso-text-muted)] uppercase tracking-wider font-semibold mb-2">
          Filtrar por l&iacute;nea
        </p>
        <div className="flex flex-wrap gap-1.5">
          {LANES.map((l) => (
            <button key={l} onClick={() => setLane(l)}
              className={`px-3 py-1 text-[10px] font-semibold rounded-full transition-all ${
                lane === l
                  ? "bg-[var(--ocaso-purple)] text-white shadow-[0_0_8px_rgba(124,58,237,0.4)]"
                  : "bg-[var(--ocaso-card)] text-[var(--ocaso-text-muted)] border border-[var(--ocaso-card-border)] hover:border-[var(--ocaso-purple)]/40 hover:text-[var(--ocaso-text)]"
              }`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Selected bar */}
      {myIds.size > 0 && (
        <div className="flex flex-wrap gap-1">
          {champs.filter(c => myIds.has(c.id)).slice(0, 15).map(c => (
            <button key={c.id} onClick={() => toggle(c.id)}
              className="flex items-center gap-1 bg-[var(--ocaso-purple-glow)] border border-[var(--ocaso-purple)]/30 rounded-full px-2 py-0.5 group hover:border-[var(--ocaso-danger)]/60">
              {c.imageUrl && <img src={c.imageUrl} alt="" className="w-4 h-4 rounded-full" />}
              <span className="text-[10px] text-[var(--ocaso-purple-light)] group-hover:hidden">{c.name}</span>
              <span className="text-[10px] text-[var(--ocaso-danger)] hidden group-hover:inline">Quitar</span>
            </button>
          ))}
          {myIds.size > 15 && <span className="text-[10px] text-[var(--ocaso-text-muted)] flex items-center px-1">+{myIds.size - 15} m&aacute;s</span>}
        </div>
      )}

      {/* Progress */}
      <div className="w-full bg-[var(--ocaso-bg)] rounded-full h-1 border border-[var(--ocaso-card-border)]">
        <div className="bg-gradient-to-r from-[var(--ocaso-purple-dark)] via-[var(--ocaso-purple)] to-[var(--ocaso-cyan)] h-1 rounded-full transition-all duration-300"
          style={{ width: `${(myIds.size / champs.length) * 100}%` }} />
      </div>

      {/* Encabezado del grid con conteo y filtro activo */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-[var(--ocaso-text)]">
          {filtered.length} campeones
          {lane !== "Todos" && (
            <span className="ml-1.5 text-[10px] text-[var(--ocaso-cyan)] font-normal">
              en {lane}
            </span>
          )}
        </p>
        {search && (
          <button onClick={() => setSearch("")} className="text-[10px] text-[var(--ocaso-text-muted)] hover:text-[var(--ocaso-purple-light)] transition-colors">
            Limpiar filtro
          </button>
        )}
      </div>

      {/* Grid con altura máxima */}
      <div className="max-h-[500px] overflow-y-auto -mx-1 px-1 scrollbar-thin">
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5">
          {filtered.map(champ => {
            const selected = myIds.has(champ.id);
            const tagList = (champ.tags || "").split(",").filter(Boolean);
            return (
              <button key={champ.id} onClick={() => toggle(champ.id)} disabled={saving}
                className={`relative rounded-xl p-1.5 text-center transition-all ${selected ? "selected-ocaso" : "lol-card hover:border-[var(--ocaso-card-border)]/50"}`}>
                <img src={champ.imageUrl} alt=""
                  className={`w-full aspect-square object-contain mb-0.5 rounded-lg transition-all ${selected ? "opacity-100" : "opacity-50 grayscale hover:grayscale-0 hover:opacity-80"}`} />
                <p className={`text-[8px] leading-tight truncate ${selected ? "text-[var(--ocaso-purple-light)] font-semibold" : "text-[var(--ocaso-text-muted)]"}`}>
                  {champ.name}
                </p>
                {/* Tags visibles */}
                {tagList.length > 0 && (
                  <div className="flex flex-wrap gap-0.5 justify-center mt-0.5">
                    {tagList.slice(0, 2).map(tag => {
                      const key = tag.trim().toLowerCase();
                      const label = TAG_LABELS[key] || tag.trim();
                      return (
                        <span key={key}
                          className="inline-block px-1 py-[1px] text-[6px] leading-none rounded-full bg-[var(--ocaso-card-border)]/30 text-[var(--ocaso-text-muted)] border border-[var(--ocaso-card-border)]/20">
                          {label}
                        </span>
                      );
                    })}
                    {tagList.length > 2 && (
                      <span className="text-[6px] text-[var(--ocaso-text-muted)]">+{tagList.length - 2}</span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 && <p className="text-xs text-[var(--ocaso-text-muted)] text-center py-8">Sin resultados</p>}
    </div>
  );
}
