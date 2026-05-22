"use client";

import type { SlotCalendario } from "@/types/calendario";

interface Props {
  slot: SlotCalendario;
  /** Si el slot fue filtrado out, se renderiza opaco y sin interacción. */
  opaco?: boolean;
  /** Si la búsqueda matchea este slot, borde naranja. */
  highlighted?: boolean;
  onClick?: (slot: SlotCalendario) => void;
}

const ESTADO_BORDE_IZQ: Record<string, string> = {
  CONFIRMADO: "border-l-green-500",
  PLANIFICADO: "border-l-blue-500",
  VACANTE: "border-l-amber-400",
  CANCELADO: "border-l-red-400",
};

const PROGRAMA_BADGE: Record<string, string> = {
  EF: "bg-green-100 text-green-700",
  IT: "bg-blue-100 text-blue-700",
};

/**
 * V26 — mini-card de un slot dentro de una celda de día en la vista
 * calendario mensual. Layout:
 *   ┌──────────────────────────────┐
 *   │ [EF]  EMPRESA          [+E]  │
 *   │       Nombre taller…         │
 *   └──────────────────────────────┘
 * Borde izquierdo de 3px con color del estado.
 */
export function CalendarioMensualSlotCard({
  slot,
  opaco = false,
  highlighted = false,
  onClick,
}: Props) {
  const esVacante = slot.estado === "VACANTE" || !slot.empresa_nombre;
  const borderLeft =
    ESTADO_BORDE_IZQ[slot.estado] ?? "border-l-slate-300";
  const programaBadge =
    PROGRAMA_BADGE[slot.programa] ?? "bg-slate-100 text-slate-600";
  const opacity = opaco ? "opacity-30" : "";
  const ringHighlight = highlighted
    ? "ring-2 ring-orange-400 ring-offset-1"
    : "";

  return (
    <button
      type="button"
      onClick={() => !opaco && onClick?.(slot)}
      disabled={opaco}
      className={`group relative w-full overflow-hidden rounded border border-l-[3px] ${borderLeft} bg-white px-1.5 py-1 text-left text-[10px] leading-tight transition-colors hover:bg-slate-50 disabled:cursor-default ${opacity} ${ringHighlight}`}
      title={
        esVacante
          ? `Vacante · ${slot.taller_nombre}`
          : `${slot.empresa_nombre} · ${slot.taller_nombre}`
      }
    >
      <div className="flex items-center justify-between gap-1">
        <span
          className={`rounded px-1 text-[9px] font-bold uppercase ${programaBadge}`}
        >
          {slot.programa}
        </span>
        {slot.tipo_asignacion === "EXTRA" && (
          <span className="rounded bg-amber-100 px-1 text-[9px] font-semibold text-amber-700">
            +E
          </span>
        )}
        {slot.motivo_cambio && (
          <span
            className="text-[9px] text-slate-400"
            title={`Motivo: ${slot.motivo_cambio}`}
          >
            ✎
          </span>
        )}
      </div>
      <div
        className={`mt-0.5 truncate font-semibold ${
          esVacante ? "text-slate-400 italic" : "text-slate-800"
        }`}
      >
        {esVacante ? "Vacante" : slot.empresa_nombre}
      </div>
      <div className="truncate text-[9px] text-slate-500">
        {slot.taller_nombre}
      </div>
    </button>
  );
}
