import React from "react";
import { VideoHistoryItem } from "../types";
import { History, Play, Trash2, Clock, ExternalLink } from "lucide-react";

interface HistoryListProps {
  history: VideoHistoryItem[];
  onPlay: (url: string) => void;
  onRemoveItem: (id: string) => void;
  onClearAll: () => void;
  activeId?: string;
}

export default function HistoryList({
  history,
  onPlay,
  onRemoveItem,
  onClearAll,
  activeId
}: HistoryListProps) {
  if (history.length === 0) {
    return (
      <div className="bg-brand-surface border border-brand-border rounded-xl p-6 text-center text-slate-500">
        <History className="size-6 text-slate-600 mx-auto mb-2.5" />
        <p className="text-xs">Chưa có lịch sử phát. Hãy dán một link YouTube bất kỳ để bắt đầu!</p>
      </div>
    );
  }

  const formatTimeGap = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Vừa xong";
    if (mins < 60) return `${mins} phút trước`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} giờ trước`;
    return new Date(timestamp).toLocaleDateString("vi-VN");
  };

  return (
    <div className="bg-brand-surface border border-brand-border rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-brand-border/40">
        <div className="flex items-center gap-2">
          <History className="size-4 text-slate-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">Lịch sử xem gần đây</h3>
        </div>
        <button
          onClick={onClearAll}
          className="text-[10px] text-rose-400 hover:text-rose-300 font-medium flex items-center gap-1 hover:bg-rose-500/10 px-2 py-1 rounded transition-all"
        >
          <Trash2 className="size-3" />
          Xóa toàn bộ
        </button>
      </div>

      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
        {history.map((item) => {
          const isActive = item.id === activeId;
          return (
            <div
              key={`${item.id}-${item.playedAt}`}
              className={`group flex items-center justify-between p-2 rounded-lg border text-xs transition-all ${
                isActive
                  ? "bg-brand-primary/5 border-brand-primary"
                  : "bg-brand-surface2 border-brand-border hover:border-slate-700"
              }`}
            >
              <div
                onClick={() => onPlay(item.url)}
                className="flex items-center gap-3 flex-1 cursor-pointer min-w-0"
              >
                {/* Micro Thumbnail */}
                <div className="relative size-10 rounded overflow-hidden bg-black shrink-0">
                  <img
                    src={`https://img.youtube.com/vi/${item.id}/0.jpg`}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-slate-950/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play className="size-3 text-white fill-current" />
                  </div>
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <h4 className={`text-xs font-medium leading-tight line-clamp-1 transition-colors ${
                    isActive ? "text-brand-primary" : "text-slate-300 group-hover:text-slate-100"
                  }`}>
                    {item.title}
                  </h4>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                    <span className="font-mono text-slate-400">{item.id}</span>
                    <span>•</span>
                    <span className="flex items-center gap-0.5">
                      <Clock className="size-2.5" />
                      {formatTimeGap(item.playedAt)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 ml-2">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Mở tab chính thức"
                  className="p-1.5 rounded text-slate-500 hover:text-slate-200 hover:bg-white/5 transition-colors"
                >
                  <ExternalLink className="size-3.5" />
                </a>
                <button
                  onClick={() => onRemoveItem(item.id)}
                  title="Xóa khỏi lịch sử"
                  className="p-1.5 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/5 transition-colors"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
