"use client";

import type { SlotCalendario } from "@/types/calendario";
import { CalendarioMensualSlotCard } from "./CalendarioMensualSlotCard";

interface Props {
  fecha: Date;
  /** True si la fecha pertenece al mes navegado actualmente. */
  enMesActivo: boolean;
  /** Motivo del festivo si aplica; null si no es festivo. */
  festivoMotivo: string | null;
  /** Slots de este (semana, día), ordenados por horario. */
  slots: SlotCalendario[];
  /**
   * Conjunto de slot.id que el filtro deja visibles. Si está vacío significa
   * "sin filtro activo" (mostrar todos opacos=false).
   */
  slotsVisibles: Set<number> | null;
  /** Conjunto de slot.id que matchean la búsqueda (borde naranja). */
  slotsHighlighted: Set<number>;
  onClickSlot: (slot: SlotCalendario) => void;
}

const DIAS_LMV_LABEL: Record<string, string> = {
  L: "Lun",
  M: "Mar",
  X: "Mié",
  J: "Jue",
  V: "Vie",
};

const DIA_CODE_FROM_JSDAY: Record<number, string> = {
  1: "L",
  2: "M",
  3: "X",
  4: "J",
  5: "V",
};

/**
 * V26 — celda de un día (L-V) en la vista calendario mensual. Apila hasta 3
 * mini-cards (3 franjas: mañana temprano, mañana tarde, tarde). Si hay más
 * de 3 slots (caso doble), apila verticalmente y deja scroll vertical
 * dentro de la celda.
 */
export function CalendarioMensualCelda({
  fecha,
  enMesActivo,
  festivoMotivo,
  slots,
  slotsVisibles,
  slotsHighlighted,
  onClickSlot,
}: Props) {
  const diaCode = DIA_CODE_FROM_JSDAY[fecha.getDay()];
  const diaLabel = diaCode ? DIAS_LMV_LABEL[diaCode] : "";
  const dd = fecha.getDate();

  if (!enMesActivo) {
    return (
      <div className="min-h-[120px] rounded border border-dashed border-slate-200 bg-slate-50/40 p-1.5 text-[10px] text-slate-300">
        <div className="font-semibold">{diaLabel} {dd}</div>
        <div className="mt-2 italic">Fuera del mes</div>
      </div>
    );
  }

  if (festivoMotivo) {
    return (
      <div className="min-h-[120px] rounded border border-slate-200 bg-slate-100 p-1.5 text-[10px]">
        <div className="font-semibold text-slate-600">{diaLabel} {dd}</div>
        <div className="mt-2 rounded bg-slate-200/70 px-1 py-0.5 text-[9px] font-semibold text-slate-600">
          Festivo
        </div>
        <div className="mt-1 truncate text-[9px] text-slate-500" title={festivoMotivo}>
          {festivoMotivo}
        </div>
      </div>
    );
  }

  // Ordenar slots por horario (ya viene así del backend, defensivo).
  const slotsOrdenados = [...slots].sort((a, b) =>
    (a.horario ?? "").localeCompare(b.horario ?? ""),
  );

  return (
    <div className="flex min-h-[120px] flex-col rounded border border-slate-200 bg-white p-1.5 text-[10px]">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-semibold text-slate-700">
          {diaLabel} {dd}
        </span>
        {slots.length > 0 && (
          <span className="text-[9px] text-slate-400">
            {slots.length}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto pr-0.5">
        {slotsOrdenados.length === 0 ? (
          <div className="flex-1 text-[9px] italic text-slate-300">
            sin slots
          </div>
        ) : (
          slotsOrdenados.map((s) => {
            const opaco =
              slotsVisibles !== null && !slotsVisibles.has(s.id);
            const highlighted = slotsHighlighted.has(s.id);
            return (
              <CalendarioMensualSlotCard
                key={s.id}
                slot={s}
                opaco={opaco}
                highlighted={highlighted}
                onClick={onClickSlot}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
