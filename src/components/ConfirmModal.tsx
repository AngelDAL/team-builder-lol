"use client";

import { useEffect, useRef } from "react";

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  open,
  title,
  message,
  confirmText = "Eliminar",
  cancelText = "Cancelar",
  danger = true,
  onConfirm,
  onCancel,
}: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      // Trap focus and handle escape
      const handler = (e: KeyboardEvent) => {
        if (e.key === "Escape") onCancel();
        if (e.key === "Enter") onConfirm();
      };
      document.addEventListener("keydown", handler);
      // Focus the confirm button
      setTimeout(() => confirmRef.current?.focus(), 50);
      return () => document.removeEventListener("keydown", handler);
    }
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onCancel} />

      {/* Modal */}
      <div className="relative bg-[var(--ocaso-card)] border border-[var(--ocaso-card-border)] rounded-2xl shadow-2xl w-full max-w-sm animate-up overflow-hidden">
        {/* Icon */}
        <div className="flex justify-center pt-6 pb-2">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${danger ? "bg-red-900/20" : "bg-[var(--ocaso-purple-glow)]"}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={danger ? "#E84057" : "#A78BFA"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {danger ? (
                <>
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </>
              ) : (
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              )}
            </svg>
          </div>
        </div>

        <div className="px-6 pb-2 text-center">
          <h3 className="text-sm font-bold text-[var(--ocaso-text)] mb-1">{title}</h3>
          <p className="text-xs text-[var(--ocaso-text-muted)] leading-relaxed">{message}</p>
        </div>

        <div className="flex gap-2 p-4">
          <button onClick={onCancel}
            className="flex-1 px-3 py-2 rounded-lg text-xs font-medium border border-[var(--ocaso-card-border)] text-[var(--ocaso-text-muted)] hover:text-[var(--ocaso-text)] hover:bg-[var(--ocaso-card-border)]/30 transition-all">
            {cancelText}
          </button>
          <button ref={confirmRef} onClick={onConfirm}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
              danger
                ? "bg-red-600 text-white hover:bg-red-500"
                : "btn-ocaso"
            }`}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
