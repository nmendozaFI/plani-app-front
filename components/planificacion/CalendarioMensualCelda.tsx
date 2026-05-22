"use client";

import type { SlotCalendario } from "@/types/calendario";
import { CalendarioMensualSlotCard } from "./CalendarioMensualSlotCard";

interface Props {
  fecha: Date;
  semana: number;
  dia: string;
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
  /** V26 (fixes post-validación): true si esta celda pertenece a la fila de
   *  la semana actualmente seleccionada en el page. Pinta el fondo amber. */
  enSemanaResaltada: boolean;
  onClickSlot: (slot: SlotCalendario) => void;
  /** V26 (Paso 4): click en botón "+ HH:MM" de una franja libre. */
  onCreateClick: (params: {
    semana: number;
    dia: string;
    horario: string;
    tipoSugerido: "EF" | "IT" | null;
  }) => void;
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

// V26 (Paso 4): franjas fijas del proyecto (espejo de CalendarioWizard).
// Viernes no tiene tarde — fuente única para evitar drift entre vistas.
const FRANJAS_LJ = ["09:30-11:30", "12:00-14:00", "15:00-17:00"];
const FRANJAS_V = ["09:30-11:30", "12:00-14:00"];

function getFranjas(dia: string): string[] {
  return dia === "V" ? FRANJAS_V : FRANJAS_LJ;
}

/**
 * V26 — celda de un día (L-V) en la vista calendario mensual. Apila las
 * mini-cards existentes (1-2 por franja, hasta 3 franjas L-J / 2 V), y en
 * cada franja con menos de 2 slots dibuja un botón "+ HH:MM" para crear uno
 * nuevo. Si hay 1 slot del tipo opuesto, el botón abre el modal con tipo
 * bloqueado al libre.
 */
export function CalendarioMensualCelda({
  fecha,
  semana,
  dia,
  enMesActivo,
  festivoMotivo,
  slots,
  slotsVisibles,
  slotsHighlighted,
  enSemanaResaltada,
  onClickSlot,
  onCreateClick,
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

  // V26 (Paso 4): calcular franjas libres del día. Una franja con <2 slots es
  // libre. Si tiene 1 slot, el tipo del existente se pasa como `tipoSugerido`
  // y el modal bloquea el opuesto. DOBLEs (2 slots del mismo programa) cuentan
  // como llena — su flujo de creación vive en /planificacion/doble.
  const franjasDelDia = getFranjas(dia);
  const franjasLibres = franjasDelDia
    .map((horario) => {
      const slotsEnFranja = slotsOrdenados.filter((s) => s.horario === horario);
      if (slotsEnFranja.length >= 2) return null;
      const tipoSugerido: "EF" | "IT" | null =
        slotsEnFranja.length === 1
          ? ((slotsEnFranja[0].programa as "EF" | "IT") ?? null)
          : null;
      return { horario, tipoSugerido };
    })
    .filter((f): f is { horario: string; tipoSugerido: "EF" | "IT" | null } => f !== null);

  return (
    <div
      className={`flex min-h-[120px] flex-col rounded border p-1.5 text-[10px] ${
        enSemanaResaltada
          ? "border-amber-300 bg-amber-50 ring-1 ring-amber-200"
          : "border-slate-200 bg-white"
      }`}
    >
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
          <div className="text-[9px] italic text-slate-300">
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
        {franjasLibres.length > 0 && (
          <div className="mt-auto flex flex-wrap gap-0.5 pt-1">
            {franjasLibres.map((f) => (
              <button
                key={f.horario}
                type="button"
                onClick={() =>
                  onCreateClick({
                    semana,
                    dia,
                    horario: f.horario,
                    tipoSugerido: f.tipoSugerido,
                  })
                }
                className="rounded border border-dashed border-slate-300 bg-slate-50 px-1 py-0.5 text-[9px] text-slate-500 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                title={
                  f.tipoSugerido
                    ? `Crear slot a las ${f.horario} (tipo ${f.tipoSugerido === "EF" ? "IT" : "EF"})`
                    : `Crear slot a las ${f.horario}`
                }
              >
                + {f.horario.split("-")[0]}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
