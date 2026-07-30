"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import useWebSocket from "@/hooks/useWebSocket";

interface Champ { id: number; name: string; imageUrl: string }
interface User { id: number; summonerName: string; tag: string; primaryRole: string | null; profileIconId: number | null }
interface Slot { userId: number | null; championId: number | null }

const ROLES = ["top","jungle","mid","adc","support"];
const RL: Record<string,string> = { top:"Top", jungle:"Jungla", mid:"Mid", adc:"ADC", support:"Soporte" };

function hdrs() {
  const t = localStorage.getItem("lolteam_token");
  return { "Content-Type": "application/json", Authorization: `Bearer ${t}` };
}

function Avatar({ u, sz = 28 }: { u: User; sz?: number }) {
  const [f, sf] = useState(false);
  if (u.profileIconId && !f)
    return <img src={`/api/assets/profile-icon/${u.profileIconId}.png`} alt=""
      className="rounded-full object-cover shrink-0" style={{width:sz,height:sz}}
      onError={() => sf(true)} />;
  const c = u.summonerName.charAt(0).toUpperCase();
  return <svg width={sz} height={sz} viewBox="0 0 32 32" className="shrink-0">
    <circle cx="16" cy="16" r="15" fill="url(ag)" stroke="#7C3AED" strokeWidth="1.5" />
    <defs><linearGradient id="ag" x1="0" y1="0" x2="32" y2="32">
      <stop offset="0%" stopColor="#7C3AED" /><stop offset="100%" stopColor="#22D3EE" />
    </linearGradient></defs>
    <text x="16" y="16" textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize="13" fontWeight="700">{c}</text>
  </svg>;
}

export default function NewCompPage() {
  const rtr = useRouter();
  const { notifyChange } = useWebSocket();
  const [nm, setNm] = useState("");
  const [us, setUs] = useState<User[]>([]);
  const [ch, setCh] = useState<Champ[]>([]);
  const [uc, setUc] = useState<Record<number,Champ[]>>({});
  const [sl, setSl] = useState<Record<string,Slot>>({});
  const [showPicker, setShowPicker] = useState<string|null>(null);
  const [tab, setTab] = useState<"pool"|"all">("pool");
  const [q, setQ] = useState("");
  const [ld, setLd] = useState(true);
  const [sv, setSv] = useState(false);
  const [er, setEr] = useState("");
  const [cid, setCid] = useState<number|null>(null);
  // "Jugar otro" state: which user we're picking an off-pool champion for
  const [jugarOtroUser, setJugarOtroUser] = useState<number|null>(null);
  const [jugarOtroQ, setJugarOtroQ] = useState("");
  const cr = useRef<number|null>(null);
  const nr = useRef(nm); nr.current = nm;
  const slRef = useRef(sl); slRef.current = sl;

  // ── Load existing composition for editing ──
  useEffect(() => {
    const tk = localStorage.getItem("lolteam_token");
    if (!tk) { rtr.push("/"); return; }
    (async () => {
      try {
        const [uR, cR] = await Promise.all([
          fetch("/api/users", { headers: hdrs() }),
          fetch("/api/champions"),
        ]);
        setUs((await uR.json()).users || []);
        setCh((await cR.json()).champions || []);
      } catch {}
      finally { setLd(false); }
    })();

    // Check for ?edit=ID to load existing composition
    const editId = new URLSearchParams(window.location.search).get("edit");
    if (editId) {
      (async () => {
        try {
          const r = await fetch(`/api/compositions/${editId}`, { headers: hdrs() });
          const d = await r.json();
          if (r.ok && d.composition) {
            const comp = d.composition;
            setNm(comp.name || "");
            const slots: Record<string,Slot> = {};
            (comp.slots || []).forEach((s: any) => {
              slots[s.role] = { userId: s.userId, championId: s.championId };
            });
            setSl(slots);
            slRef.current = slots;
            cr.current = comp.id;
            setCid(comp.id);
          }
        } catch {}
      })();
    }
  }, [rtr]);

  const sync = useCallback(async (ns: Record<string,Slot>) => {
    const filled = Object.entries(ns)
      .filter(([,s]) => s.userId != null && s.championId != null)
      .map(([role,s]) => ({ role, userId: s.userId!, championId: s.championId! }));
    const n = nr.current.trim() || "Sin nombre";
    setSv(true); setEr("");
    try {
      if (cr.current === null) {
        const r = await fetch("/api/compositions", { method:"POST", headers:hdrs(),
          body: JSON.stringify({ name:n, slots:filled, draft: true }) });
        const d = await r.json();
        if (!r.ok) { setEr(d.error||"Error"); return; }
        cr.current = d.composition.id; setCid(d.composition.id);
      } else {
        await fetch(`/api/compositions?id=${cr.current}`, { method:"PATCH", headers:hdrs(),
          body: JSON.stringify({ name:n, slots:filled }) });
      }
      notifyChange("composition");
    } catch { setEr("Error red"); }
    finally { setSv(false); }
  }, [notifyChange]);

  const nt = useRef<any>(null);
  useEffect(() => {
    if (nm.trim()) {
      clearTimeout(nt.current);
      nt.current = setTimeout(() => sync(slRef.current), 800);
    }
    return () => clearTimeout(nt.current);
  }, [nm, sync]);

  const assign = async (role: string, userId: number, champId: number) => {
    const ns = { ...sl, [role]: { userId, championId: champId } };
    setSl(ns); setShowPicker(null);
    // Clear jugarOtro state
    setJugarOtroUser(null);
    setJugarOtroQ("");
    await sync(ns);
  };

  const remove = async (role: string) => {
    const ns = { ...sl }; delete ns[role];
    setSl(ns);
    await sync(ns);
  };

  const loadUc = useCallback(async (uid: number) => {
    if (uc[uid]) return;
    try {
      const r = await fetch(`/api/user/champions?userId=${uid}`, { headers:hdrs() });
      const d = await r.json();
      setUc(p => ({ ...p, [uid]: d.champions || [] }));
    } catch {}
  }, [uc]);

  useEffect(() => {
    if (showPicker && us.length) {
      const cands = us.filter(u => u.primaryRole === showPicker || !us.some(x => x.primaryRole === showPicker));
      cands.forEach(u => loadUc(u.id));
    }
  }, [showPicker, us, loadUc]);

  // Map of userId → role they already occupy in the current slots
  const urm: Record<number,string> = {};
  for (const [role, s] of Object.entries(sl)) { if (s.userId != null) urm[s.userId] = role; }

  const fl = Object.keys(sl).length;
  const candidates = showPicker
    ? us.filter(u => u.primaryRole === showPicker || !us.some(x => x.primaryRole === showPicker))
    : [];

  if (ld) return <div className="p-4 space-y-3 max-w-4xl mx-auto">
    {[1,2,3,4,5].map(i => <div key={i} className="loading-shimmer h-16" />)}</div>;

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      {/* Back navigation */}
      <div className="px-4 pt-3 pb-1">
        <button onClick={() => rtr.back()}
          className="flex items-center gap-1 text-[10px] text-[var(--ocaso-text-muted)] hover:text-[var(--ocaso-purple-light)] transition-colors">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Volver
        </button>
      </div>

      {/* Name bar */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <input type="text" value={nm} onChange={e => setNm(e.target.value)}
          className="input-ocaso flex-1 px-4 py-2.5 text-sm font-semibold"
          placeholder="Nombre de la composición" />
        {cid && <span className="badge-ocaso shrink-0">#{cid}</span>}
        {sv && <span className="text-[10px] text-[var(--ocaso-cyan)] animate-pulse shrink-0">Guardando...</span>}
      </div>
      {er && <div className="px-4 pb-2"><div className="bg-red-900/20 border border-red-800/30 text-red-400 px-3 py-2 rounded-xl text-xs">{er}</div></div>}

      {/* Team preview — roles con min-width y wrap en móvil */}
      <div className="flex flex-wrap justify-center gap-2 px-4 py-2">
        {ROLES.map(role => {
          const slot = sl[role];
          const champ = slot?.championId ? ch.find(c => c.id === slot.championId) : null;
          const user = slot?.userId ? us.find(u => u.id === slot.userId) : null;
          const isActive = showPicker === role;
          return (
            <button key={role} onClick={() => {
              setShowPicker(isActive ? null : role);
              setJugarOtroUser(null); setJugarOtroQ("");
            }}
              className={`relative rounded-xl text-center transition-all cursor-pointer flex-1 min-w-[70px] sm:min-w-0 sm:flex-1 ${
                isActive ? "ring-2 ring-[var(--ocaso-purple)] bg-[var(--ocaso-purple-glow)]" : ""
              } ${slot ? "bg-[var(--ocaso-card)] border border-[var(--ocaso-purple)]/30" : "bg-[var(--ocaso-card)]/60 border border-dashed border-[var(--ocaso-card-border)]"}`}
              style={{padding: slot ? "8px 4px" : "12px 4px"}}>
              {slot && <button onClick={e => { e.stopPropagation(); remove(role); }}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500/90 rounded-full flex items-center justify-center text-white text-[10px] hover:bg-red-600 transition-colors z-10 shadow">✕</button>}
              <p className="text-[10px] text-[var(--ocaso-purple-light)] font-semibold uppercase tracking-wide mb-1">{RL[role]}</p>
              {champ ? (
                <img src={champ.imageUrl} alt={champ.name} className="w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-full border-2 border-[var(--ocaso-card-border)] object-cover" />
              ) : (
                <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-full border-2 border-dashed border-[var(--ocaso-card-border)] flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </div>
              )}
              <p className="text-[11px] sm:text-xs font-medium mt-1 truncate">{champ?.name || "—"}</p>
              {user && <p className="text-[9px] sm:text-[10px] text-[var(--ocaso-text-muted)] truncate">{user.summonerName}<span className="text-[var(--ocaso-cyan)]">#{user.tag}</span></p>}
            </button>
          );
        })}
      </div>

      {/* Champion picker — slides in below */}
      <div className={`transition-all duration-300 ease-in-out overflow-hidden ${showPicker ? "max-h-[200vh] opacity-100" : "max-h-0 opacity-0"}`}>
        {showPicker && (
          <div className="px-4 py-3 space-y-3 min-h-[250px]">
            {/* Tabs */}
            <div className="flex gap-1">
              <button onClick={() => { setTab("pool"); setJugarOtroUser(null); setJugarOtroQ(""); }}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${tab==="pool" ? "bg-[var(--ocaso-purple)]/20 text-[var(--ocaso-purple-light)]" : "bg-[var(--ocaso-card)] text-[var(--ocaso-text-muted)] hover:text-[var(--ocaso-text)]"}`}>
                Pool {RL[showPicker]}
              </button>
              <button onClick={() => { setTab("all"); setJugarOtroUser(null); setJugarOtroQ(""); }}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${tab==="all" ? "bg-[var(--ocaso-purple)]/20 text-[var(--ocaso-purple-light)]" : "bg-[var(--ocaso-card)] text-[var(--ocaso-text-muted)] hover:text-[var(--ocaso-text)]"}`}>
                Todos los champs
              </button>
            </div>

            {tab === "pool" ? (
              <div className="flex flex-col gap-3">
                {candidates.filter(u => !urm[u.id] || urm[u.id] === showPicker).length === 0 ? (
                  <div className="bg-[var(--ocaso-card)]/60 border border-dashed border-[var(--ocaso-card-border)] rounded-xl p-6 text-center">
                    <p className="text-xs text-[var(--ocaso-text-muted)]">No hay jugadores con esta línea asignada</p>
                    <button onClick={() => setTab("all")}
                      className="mt-2 text-[10px] text-[var(--ocaso-purple-light)] hover:text-[var(--ocaso-cyan)] transition-colors">
                      Elegir del listado completo →
                    </button>
                  </div>
                ) : (
                  candidates.filter(u => !urm[u.id] || urm[u.id] === showPicker).map(user => {
                    const champs = uc[user.id] || [];
                    const isJugandoOtro = jugarOtroUser === user.id;
                    return (
                      <div key={user.id}
                        className="bg-[var(--ocaso-card)] border border-[var(--ocaso-card-border)] rounded-xl p-3 hover:border-[var(--ocaso-purple)]/30 transition-all">
                        {/* Player header */}
                        <div className="flex items-center gap-2.5 mb-3">
                          <Avatar u={user} sz={34} />
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <p className="text-sm font-semibold truncate">{user.summonerName}<span className="text-[var(--ocaso-cyan)] font-normal">#{user.tag}</span></p>
                              <span className="badge-ocaso shrink-0">{RL[user.primaryRole || ""] || user.primaryRole}</span>
                            </div>
                            <p className="text-[10px] text-[var(--ocaso-text-muted)]">{champs.length} campeón{champs.length !== 1 ? "es" : ""} en pool</p>
                          </div>
                        </div>

                        {/* Champion pool — natural flow, no scroll */}
                        {champs.length > 0 ? (
                          <div className="mb-3">
                            <p className="text-[9px] uppercase tracking-widest text-[var(--ocaso-text-muted)]/60 font-semibold mb-2 ml-0.5">Campeones disponibles</p>
                            <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-1.5 mb-2">
                              {champs.map(champ => (
                                <button key={champ.id} onClick={() => assign(showPicker, user.id, champ.id)}
                                  className="p-1 rounded-lg bg-[var(--ocaso-bg)] border border-[var(--ocaso-card-border)] hover:border-[var(--ocaso-purple)] transition-all text-center group">
                                  <img src={champ.imageUrl} alt="" className="w-full aspect-square object-contain rounded" />
                                  <p className="text-[7px] truncate text-[var(--ocaso-text-muted)] group-hover:text-[var(--ocaso-purple-light)] transition-colors mt-0.5">{champ.name}</p>
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="text-[10px] text-[var(--ocaso-text-muted)] italic mb-3 py-3 text-center border border-dashed border-[var(--ocaso-card-border)] rounded-lg">
                            Sin campeones registrados en el pool
                          </div>
                        )}

                        {/* "Jugar otro" section */}
                        <div className="border-t border-[var(--ocaso-card-border)] pt-3 mt-1">
                          {isJugandoOtro ? (
                            <div className="animate-fade-in space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-[var(--ocaso-cyan)] font-medium">Selecciona para {user.summonerName}</span>
                                <button onClick={() => { setJugarOtroUser(null); setJugarOtroQ(""); }}
                                  className="text-[10px] text-[var(--ocaso-text-muted)] hover:text-white ml-auto transition-colors px-2 py-0.5 rounded border border-[var(--ocaso-card-border)] hover:border-red-500/50">
                                  Cancelar
                                </button>
                              </div>
                              <input type="text" value={jugarOtroQ}
                                onChange={e => setJugarOtroQ(e.target.value)}
                                className="input-ocaso w-full px-3 py-2 text-sm"
                                placeholder="Buscar campeón fuera del pool..." autoFocus />
                              {jugarOtroQ.trim() ? (
                                <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-1.5 max-h-[35vh] sm:max-h-[45vh] overflow-y-auto rounded-lg bg-[var(--ocaso-bg)]/50 p-1.5">
                                  {ch.filter(c => c.name.toLowerCase().includes(jugarOtroQ.toLowerCase()))
                                    .map(champ => (
                                    <button key={champ.id} onClick={() => assign(showPicker, user.id, champ.id)}
                                      className="p-1 rounded-lg bg-[var(--ocaso-bg)] border border-[var(--ocaso-cyan)]/30 hover:border-[var(--ocaso-cyan)] transition-all text-center group">
                                      <img src={champ.imageUrl} alt="" className="w-full aspect-square object-contain rounded" />
                                      <p className="text-[7px] truncate text-[var(--ocaso-text-muted)] group-hover:text-[var(--ocaso-cyan)] transition-colors mt-0.5">{champ.name}</p>
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[10px] text-[var(--ocaso-text-muted)] italic py-1">Escribe el nombre del campeón que quieres jugar...</p>
                              )}
                            </div>
                          ) : (
                            <button onClick={() => { setJugarOtroUser(user.id); setJugarOtroQ(""); }}
                              className="w-full py-2 rounded-lg border border-dashed border-[var(--ocaso-purple)]/30 hover:border-[var(--ocaso-purple)]/70 bg-[var(--ocaso-purple-glow)]/30 hover:bg-[var(--ocaso-purple-glow)]/60 transition-all text-center flex items-center justify-center gap-1.5 group">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                className="text-[var(--ocaso-purple-light)] group-hover:text-[var(--ocaso-cyan)] transition-colors shrink-0">
                                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                              </svg>
                              <span className="text-[11px] sm:text-[10px] text-[var(--ocaso-purple-light)] group-hover:text-[var(--ocaso-cyan)] transition-colors">Jugar otro campeón</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              <div>
                <input type="text" value={q} onChange={e => setQ(e.target.value)}
                  className="input-ocaso w-full px-3 py-2 text-sm mb-2" placeholder="Buscar campeón..." />
                <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-1.5 max-h-[45vh] sm:max-h-[60vh] overflow-y-auto rounded-lg bg-[var(--ocaso-bg)]/30 p-1.5">
                  {(q ? ch.filter(c => c.name.toLowerCase().includes(q.toLowerCase())) : ch).map(champ => (
                    <button key={champ.id} onClick={() => assign(showPicker, 0, champ.id)}
                      className="p-1 rounded-lg bg-[var(--ocaso-bg)] border border-[var(--ocaso-card-border)] hover:border-[var(--ocaso-purple)] transition-all text-center group">
                      <img src={champ.imageUrl} alt="" className="w-full aspect-square object-contain rounded" />
                      <p className="text-[7px] truncate text-[var(--ocaso-text-muted)] group-hover:text-[var(--ocaso-purple-light)] transition-colors mt-0.5">{champ.name}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[10px] text-[var(--ocaso-text-muted)] px-4 py-2">
        <span>{fl}/5 posiciones</span>
        {cid && <span className="text-[var(--ocaso-cyan)]">Editando #{cid}</span>}
      </div>
    </div>
  );
}
