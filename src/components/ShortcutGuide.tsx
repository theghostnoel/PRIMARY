import React from "react";
import { Keyboard, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ShortcutGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ShortcutGuide({ isOpen, onClose }: ShortcutGuideProps) {
  const shortcuts = [
    { keys: ["Space"], desc: "Phát hoặc tạm dừng video" },
    { keys: ["←", "→"], desc: "Tua lùi / Tua tiến 5 giây" },
    { keys: ["↑", "↓"], desc: "Tăng / Giảm âm lượng" },
    { keys: ["M"], desc: "Bật/Tắt tiếng nhanh" },
    { keys: ["L"], desc: "Bật/Tắt chế độ phát lặp lại" },
    { keys: ["F"], desc: "Phóng to / Thoát toàn màn hình" },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.7 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#000] z-50 backdrop-blur-xs"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="fixed inset-0 m-auto max-w-md h-fit bg-brand-surface border border-brand-border rounded-xl shadow-2xl z-50 overflow-hidden text-slate-300 pointer-events-auto p-6"
          >
            <div className="flex items-center justify-between pb-4 border-b border-brand-border">
              <div className="flex items-center gap-2">
                <Keyboard className="size-5 text-brand-primary" />
                <h3 className="text-base font-semibold text-slate-100">Phím tắt bàn phím</h3>
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-md text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-5 space-y-3.5">
              {shortcuts.map((sh, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">{sh.desc}</span>
                  <div className="flex gap-1.5">
                    {sh.keys.map((key, keyIdx) => (
                      <kbd
                        key={keyIdx}
                        className="px-2 py-1 bg-brand-surface2 rounded border border-brand-border text-slate-200 font-mono text-[11px] min-w-8 text-center shadow-xs"
                      >
                        {key}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-brand-border/60 text-[11px] text-slate-500 text-center">
              Nhấp chuột ra ngoài hoặc ấn nút đóng để tiếp tục tải video.
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
