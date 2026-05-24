import React from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, CheckCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info";

export interface ToastMessage {
  id: string;
  text: string;
  type: ToastType;
}

interface NotificationProps {
  toasts: ToastMessage[];
  onRemove: (id: string) => void;
}

export default function Notification({ toasts, onRemove }: NotificationProps) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
            layout
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-lg backdrop-blur-md ${
              toast.type === "success"
                ? "bg-[#101f18]/90 border-emerald-500/30 text-emerald-300"
                : toast.type === "error"
                ? "bg-[#251415]/90 border-rose-500/30 text-rose-300"
                : "bg-brand-surface/90 border-brand-border text-slate-300"
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {toast.type === "success" && <CheckCircle className="size-4.5 text-emerald-400" />}
              {toast.type === "error" && <AlertTriangle className="size-4.5 text-rose-400" />}
              {toast.type === "info" && <Info className="size-4.5 text-blue-400" />}
            </div>
            
            <div className="flex-1 text-xs font-medium leading-relaxed">
              {toast.text}
            </div>

            <button
              onClick={() => onRemove(toast.id)}
              className="shrink-0 p-0.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-colors"
            >
              <X className="size-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
