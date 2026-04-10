"use client";

interface PrioridadBadgeProps {
  prioridad: string;
}

const CONFIG: Record<string, { bg: string; text: string }> = {
  ALTA: { bg: "bg-rose-100 border-rose-300", text: "text-rose-700" },
  MEDIA: { bg: "bg-slate-100 border-slate-300", text: "text-slate-600" },
  BAJA: { bg: "bg-sky-100 border-sky-300", text: "text-sky-700" },
};

export function PrioridadBadge({ prioridad }: PrioridadBadgeProps) {
  const cfg = CONFIG[prioridad] || CONFIG.MEDIA;
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cfg.bg} ${cfg.text}`}
    >
      {prioridad}
    </span>
  );
}