"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getRoleIcon } from "@/components/OcasoIcons";
import ConfirmModal from "@/components/ConfirmModal";
import useWebSocket from "@/hooks/useWebSocket";

interface Comp {
  id: number; name: string; description: string | null;
  createdAt: string; creator: { summonerName: string; tag: string };
  slots: Array<{
    role: string;
    champion: { name: string; imageUrl: string };
    substitutes?: Array<{ id: number }>;
  }>;
}

const ROLES = ["top","jungle","mid","adc","support"];

export default function CompositionsPage() {
  const router = useRouter();
  const { addListener, notifyChange } = useWebSocket();
  const [comps, setComps] = useState<Comp[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Comp | null>(null);

  const fetchAll = useCallback(async () => {
    const token = localStorage.getItem("lolteam_token");
    if (!token) { router.push("/"); return; }
    try {
      const res = await fetch("/api/compositions", { headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      setComps(d.compositions || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => {
    fetchAll();
    const unsub = addListener(m => { if (m.type === "data_changed") fetchAll(); });
    return () => { unsub(); };
  }, [fetchAll, addListener]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const token = localStorage.getItem("lolteam_token");
    const res = await fetch(`/api/compositions?id=${deleteTarget.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setComps(p => p.filter(c => c.id !== deleteTarget.id));
      notifyChange("comp");
    }
    setDeleteTarget(null);
  };

  // ── Helper: count total substitutes across all slots ──
  const countSubstitutes = (comp: Comp): number => {
    let total = 0;
    for (const slot of comp.slots) {
      total += slot.substitutes?.length ?? 0;
    }
    return total;
  };

  if (loading) return (
    <div className="max-w-3xl mx-auto p-4 space-y-3">
      {[1,2].map(i => <div key={i} className="loading-shimmer h-20" />)}
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-base font-bold text-[var(--ocaso-text)]">Composiciones</h1>
          <p className="text-[11px] text-[var(--ocaso-text-muted)]">{comps.length} composiciones</p>
        </div>
        <button onClick={() => router.push("/compositions/new")}
          className="btn-ocaso text-[11px] px-3 py-1.5">+ Nueva</button>
      </div>

      {comps.length === 0 ? (
        <div className="lol-card p-10 text-center border-dashed">
          <p className="text-xs text-[var(--ocaso-text-muted)]">Aún no hay composiciones</p>
        </div>
      ) : (
        <div className="space-y-2">
          {comps.map(comp => {
            const subCount = countSubstitutes(comp);
            return (
              <div key={comp.id}
                className="lol-card p-4 flex items-center gap-4 cursor-pointer"
                onClick={() => router.push(`/compositions/${comp.id}`)}>
                {/* Champion avatars */}
                <div className="flex -space-x-2 shrink-0">
                  {[...comp.slots].sort((a,b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role)).map((s,i) => (
                    <div key={i} className="w-9 h-9 rounded-full border-2 border-[var(--ocaso-card)] overflow-hidden">
                      {s.champion.imageUrl
                        ? <img src={s.champion.imageUrl} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full bg-[var(--ocaso-card-border)]" />}
                    </div>
                  ))}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[var(--ocaso-text)] truncate">{comp.name}</p>
                    {subCount > 0 && (
                      <span className="badge-ocaso text-[9px] px-1.5 py-0.5 shrink-0">
                        {subCount} sustituto{subCount !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  {comp.description && <p className="text-[10px] text-[var(--ocaso-text-muted)] truncate">{comp.description}</p>}
                  <p className="text-[10px] text-[var(--ocaso-text-muted)] mt-0.5">
                    por {comp.creator.summonerName}
                    <span className="mx-1">·</span>
                    {comp.slots.filter(s => s.champion).length}/5 slots
                  </p>
                </div>
                {/* Action */}
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={e => { e.stopPropagation(); setDeleteTarget(comp); }}
                    className="text-[var(--ocaso-text-muted)] hover:text-[var(--ocaso-danger)] transition-colors p-1">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Eliminar composición"
        message={`¿Eliminar "${deleteTarget?.name || ""}"? Esta acción no se puede deshacer.`}
        confirmText="Sí, eliminar"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
