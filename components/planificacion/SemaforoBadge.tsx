"use client";

interface SemaforoBadgeProps {
  semaforo: string;
  size?: "sm" | "md";
}

const CONFIG: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  VERDE: {
    bg: "bg-emerald-50 border-emerald-200",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
    label: "Verde",
  },
  AMBAR: {
    bg: "bg-amber-50 border-amber-200",
    text: "text-amber-700",
    dot: "bg-amber-500",
    label: "Ámbar",
  },
  ROJO: {
    bg: "bg-red-50 border-red-200",
    text: "text-red-700",
    dot: "bg-red-500",
    label: "Rojo",
  },
};

export function SemaforoBadge({ semaforo, size = "sm" }: SemaforoBadgeProps) {
  const cfg = CONFIG[semaforo] || CONFIG.AMBAR;
  const sizeClasses = size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${cfg.bg} ${cfg.text} ${sizeClasses}`}
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}