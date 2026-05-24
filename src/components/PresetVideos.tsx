import React, { useState } from "react";
import { CuratedPreset } from "../types";
import { CURATED_PRESETS } from "../data";
import { Music, Play, Radio, Flame, Compass } from "lucide-react";

interface PresetVideosProps {
  onSelectVideo: (url: string) => void;
  activeId?: string;
}

export default function PresetVideos({ onSelectVideo, activeId }: PresetVideosProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("Tất cả");

  // Get unique categories plus 'Tất cả'
  const categories = ["Tất cả", ...Array.from(new Set(CURATED_PRESETS.map((p) => p.category)))];

  const filteredPresets = selectedCategory === "Tất cả"
    ? CURATED_PRESETS
    : CURATED_PRESETS.filter((p) => p.category === selectedCategory);

  return (
    <div className="bg-brand-surface border border-brand-border rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Radio className="size-4 text-brand-primary animate-pulse" />
        <h3 className="text-sm font-semibold text-slate-100 uppercase tracking-wider">
          Kênh Gợi ý Tập Trung & Thư Giản
        </h3>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5 mb-5 border-b border-brand-border/40 pb-3">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              selectedCategory === cat
                ? "bg-brand-primary text-white shadow-md shadow-brand-primary/10"
                : "bg-brand-surface2 border border-brand-border text-slate-400 hover:text-slate-100 hover:border-slate-700"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Preset Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPresets.map((preset) => {
          const isActive = preset.id === activeId;
          return (
            <div
              key={preset.id}
              onClick={() => onSelectVideo(preset.url)}
              className={`group flex flex-col h-full bg-brand-surface2 rounded-xl border overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
                isActive
                  ? "border-brand-primary ring-1 ring-brand-primary bg-brand-primary/5"
                  : "border-brand-border hover:border-slate-600"
              }`}
            >
              <div className="relative aspect-video w-full overflow-hidden bg-black shrink-0">
                <img
                  src={preset.thumbnail}
                  alt={preset.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="p-2.5 bg-brand-primary text-white rounded-full shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                    <Play className="size-4 fill-current" />
                  </div>
                </div>
                <span className="absolute bottom-2 right-2 bg-[#000]/70 text-[10px] text-slate-300 font-medium px-2 py-0.5 rounded backdrop-blur-xs">
                  {preset.category}
                </span>
              </div>

              <div className="p-3.5 flex-1 flex flex-col justify-between">
                <div>
                  <h4 className={`text-xs font-semibold leading-tight line-clamp-1 group-hover:text-brand-primary transition-colors ${
                    isActive ? "text-brand-primary" : "text-slate-200"
                  }`}>
                    {preset.title}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {preset.description}
                  </p>
                </div>
                
                <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-brand-border/40 text-[10px] text-slate-400 font-medium self-end">
                  <span>Chạy ngay</span>
                  <Play className="size-2.5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
