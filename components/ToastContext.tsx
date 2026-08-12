"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

interface ToastState {
  message: string;
  showUndo: boolean;
  onUndo?: () => void;
}

interface ToastContextValue {
  showToast: (message: string, opts?: { showUndo?: boolean; onUndo?: () => void }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback(
    (message: string, opts?: { showUndo?: boolean; onUndo?: () => void }) => {
      setToast({ message, showUndo: Boolean(opts?.showUndo), onUndo: opts?.onUndo });
      setVisible(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setVisible(false), 3200);
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className={`spotly-toast fixed bottom-6 left-1/2 z-[200] flex items-center gap-2 rounded-full bg-text px-5 py-3 text-sm text-white transition-opacity duration-250 ${
          visible ? "show opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <i className="bi bi-check-circle-fill text-gold" />
        <span>{toast?.message}</span>
        {toast?.showUndo && (
          <button
            className="ml-2 font-semibold text-gold underline"
            onClick={() => {
              toast.onUndo?.();
              setVisible(false);
            }}
          >
            Undo
          </button>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
