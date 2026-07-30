"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getRoleIcon } from "@/components/OcasoIcons";
import ActiveUsers from "@/components/ActiveUsers";
import useWebSocket from "@/hooks/useWebSocket";

interface Comp {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
  creator: { summonerName: string; tag: string };
  slots: Array<{ role: string; champion: { name: string; imageUrl: string } }>;
}

export default function DashboardPage() {
  const router = useRouter();
  const { onlineUsers, addListener } = useWebSocket();
  const [user, setUser] = useState<any>(null);
  const [compositions, setCompositions] = useState<Comp[]>([]);
  const [myChampCount, setMyChampCount] = useState(0);
  const [myRole, setMyRole] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem("lolteam_token");
    if (!token) return;

    try {
      const [compsRes, champsRes, usersRes] = await Promise.all([
        fetch("/api/compositions", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/user/champions", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/users", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const comps = await compsRes.json();
      const champs = await champsRes.json();
      const usersData = await usersRes.json();
      setCompositions(comps.compositions || []);
      setMyChampCount((champs.champions || []).length);
      // Get current user's role and icon
      const stored = localStorage.getItem("lolteam_user");
      if (stored) {
        const u = JSON.parse(stored);
        setUser(u);
        const me = (usersData.users || []).find((x: any) => x.id === u.id);
        if (me) {
          setMyRole(me.primaryRole || "");
          // Refresh profile icon if missing
          if (!u.profileIconId && me.profileIconId) {
            u.profileIconId = me.profileIconId;
            localStorage.setItem("lolteam_user", JSON.stringify(u));
            setUser({...u});
          } else if (!u.profileIconId && !me.profileIconId) {
            // Try Riot API to fetch icon
            fetch("/api/users/refresh-icon", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ summonerName: u.summonerName, tag: u.tag }),
            }).then(r => r.json()).then(d => {
              if (d.profileIconId) {
                u.profileIconId = d.profileIconId;
                localStorage.setItem("lolteam_user", JSON.stringify(u));
                setUser({...u});
              }
            }).catch(() => {});
          }
        }
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchData();
    const unsub = addListener((msg) => { if (msg.type === "data_changed") fetchData(); });
    return () => { unsub(); };
  }, [fetchData, addListener]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-4 space-y-3">
        {[1,2,3].map(i => <div key={i} className="loading-shimmer h-16" />)}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-[var(--ocaso-text)]">
            {user?.summonerName}
            <span className="text-[var(--ocaso-cyan)] font-normal">#{user?.tag}</span>
          </h1>
          <p className="text-[11px] text-[var(--ocaso-text-muted)]">
            {myChampCount} picks
            {myRole && <span className="ml-2 badge-ocaso">{myRole}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ActiveUsers />
          <button onClick={() => router.push("/compositions/new")}
            className="btn-ocaso text-[11px] px-3 py-1.5">+ Comp</button>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => router.push("/champions")}
          className="lol-card p-3 flex items-center gap-3 hover:border-[var(--ocaso-purple)]/30 transition-all">
          <div className="w-8 h-8 rounded-lg bg-[var(--ocaso-purple-glow)] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2">
              <path d="M12 2 L15 9 L22 9 L16 14 L18 21 L12 17 L6 21 L8 14 L2 9 L9 9 Z" />
            </svg>
          </div>
          <div className="text-left">
            <p className="text-xs font-medium text-[var(--ocaso-text)]">Mis Picks</p>
            <p className="text-[10px] text-[var(--ocaso-text-muted)]">{myChampCount} campeones</p>
          </div>
        </button>
        <button onClick={() => router.push("/compositions")}
          className="lol-card p-3 flex items-center gap-3 hover:border-[var(--ocaso-purple)]/30 transition-all">
          <div className="w-8 h-8 rounded-lg bg-[var(--ocaso-cyan)]/10 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22D3EE" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <div className="text-left">
            <p className="text-xs font-medium text-[var(--ocaso-text)]">Composiciones</p>
            <p className="text-[10px] text-[var(--ocaso-text-muted)]">{compositions.length} creadas</p>
          </div>
        </button>
      </div>

      {/* Online */}
      <div>
        <p className="text-[10px] text-[var(--ocaso-text-muted)] uppercase tracking-wider font-semibold mb-2">
          En L&iacute;nea ({onlineUsers.length})
        </p>
        <div className="flex flex-wrap gap-1.5">
          {onlineUsers.map(u => (
            <div key={u.userId} className="flex items-center gap-1.5 bg-[var(--ocaso-card)] border border-[var(--ocaso-card-border)] rounded-full px-2.5 py-1">
              <svg width="6" height="6" viewBox="0 0 6 6"><circle cx="3" cy="3" r="2.5" fill="#22D3EE" opacity="0.9" /></svg>
              <span className="text-[10px]">{u.summonerName}<span className="text-[var(--ocaso-cyan)]">#{u.tag}</span></span>
            </div>
          ))}
          {onlineUsers.length === 0 && <span className="text-[10px] text-[var(--ocaso-text-muted)] italic">Solo t&uacute;</span>}
        </div>
      </div>

      {/* Compositions */}
      <div>
        <p className="text-[10px] text-[var(--ocaso-text-muted)] uppercase tracking-wider font-semibold mb-2">
          Composiciones
        </p>
        {compositions.length === 0 ? (
          <div className="lol-card p-8 text-center border-dashed">
            <p className="text-xs text-[var(--ocaso-text-muted)]">A&uacute;n no hay composiciones</p>
            <button onClick={() => router.push("/compositions/new")} className="text-[var(--ocaso-cyan)] text-xs hover:underline mt-2 inline-block">
              Crear primera
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {compositions.map(comp => (
              <div key={comp.id}
                className="lol-card p-3 flex items-center gap-3 cursor-pointer"
                onClick={() => router.push(`/compositions/${comp.id}`)}>
                <div className="flex -space-x-1.5">
                  {comp.slots.slice(0,5).map((s,i) => (
                    <div key={i} className="w-7 h-7 rounded-full border-2 border-[var(--ocaso-card)] overflow-hidden">
                      {s.champion.imageUrl
                        ? <img src={s.champion.imageUrl} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full bg-[var(--ocaso-card-border)]" />}
                    </div>
                  ))}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[var(--ocaso-text)] truncate">{comp.name}</p>
                  <p className="text-[10px] text-[var(--ocaso-text-muted)]">por {comp.creator.summonerName}</p>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
