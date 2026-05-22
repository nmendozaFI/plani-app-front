"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import type { Festivo, SlotCalendario } from "@/types/calendario";
import {
  getDateForSlot,
  getMesesDelTrimestre,
  type MesInfo,
} from "@/lib/fecha-trimestre";
import { Button } from "@/components/ui/button";

import { CalendarioMensualCelda } from "./CalendarioMensualCelda";

interface Props {
  trimestre: string;
  slots: SlotCalendario[];
  festivos: Festivo[];
  /** Conjunto de slot.id que pasan los filtros activos. null = sin filtro. */
  slotsVisibles: Set<number> | null;
  /** Conjunto de slot.id que matchean la búsqueda actual. */
  slotsHighlighted: Set<number>;
  /** Mes inicial sugerido (mesIdx 0-11). Default: primer mes del trimestre. */
  mesInicial?: number;
  onClickSlot: (slot: SlotCalendario) => void;
}

const DIAS_LMV = ["L", "M", "X", "J", "V"] as const;

const COLUMNAS_HEADER = [
  { code: "L", label: "Lunes" },
  { code: "M", label: "Martes" },
  { code: "X", label: "Miércoles" },
  { code: "J", label: "Jueves" },
  { code: "V", label: "Viernes" },
];

/**
 * V26 — Vista calendario mensual de la página Operación. Pinta una grilla
 * L-V × ~4-5 semanas para el mes navegado actualmente, con mini-cards de
 * los slots en cada celda.
 *
 * No es responsable de la lógica de filtros ni del modal — recibe
 * `slotsVisibles`/`slotsHighlighted` y delega el click al padre (que
 * cambia a vista lista con el slot resaltado).
 */
export function CalendarioMensualView({
  trimestre,
  slots,
  festivos,
  slotsVisibles,
  slotsHighlighted,
  mesInicial,
  onClickSlot,
}: Props) {
  const mesesDelTrimestre: MesInfo[] = useMemo(
    () => getMesesDelTrimestre(trimestre),
    [trimestre],
  );

  // Determinar índice del mes activo dentro de mesesDelTrimestre. Si el
  // trimestre no tiene meses (caso degenerado), salimos.
  const initialIdx = useMemo(() => {
    if (mesesDelTrimestre.length === 0) return 0;
    if (mesInicial === undefined) return 0;
    const idx = mesesDelTrimestre.findIndex(
      (m) => m.monthIdx === mesInicial,
    );
    return idx >= 0 ? idx : 0;
  }, [mesesDelTrimestre, mesInicial]);

  const [mesIdxNav, setMesIdxNav] = useState(initialIdx);
  const mesActivo = mesesDelTrimestre[mesIdxNav];

  // Mapa (semana,dia) → motivo festivo, una sola vez por render.
  const festivoMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of festivos) {
      m.set(`${f.semana}-${f.dia}`, f.motivo);
    }
    return m;
  }, [festivos]);

  // Index slots por (semana,dia) para resolución rápida.
  const slotsByCell = useMemo(() => {
    const m = new Map<string, SlotCalendario[]>();
    for (const s of slots) {
      const key = `${s.semana}-${s.dia}`;
      const arr = m.get(key);
      if (arr) arr.push(s);
      else m.set(key, [s]);
    }
    return m;
  }, [slots]);

  if (!mesActivo) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
        No hay meses calculables para este trimestre.
      </div>
    );
  }

  // Construir filas: una fila por semana del trimestre, columnas L-V con
  // su fecha real. Solo dibujamos semanas cuya semana del trimestre tiene
  // al menos un día en el mes activo (las demás no las pintamos para no
  // engordar la grilla — la planificadora va a navegar a otro mes).
  type Celda = {
    fecha: Date;
    enMesActivo: boolean;
    semana: number;
    dia: string;
  };
  type Fila = { semana: number; celdas: Celda[] };

  const filas: Fila[] = [];
  const SEMANAS_TOTAL = 13;
  for (let s = 1; s <= SEMANAS_TOTAL; s++) {
    const celdas: Celda[] = [];
    let alMenosUnoEnMes = false;
    for (const dia of DIAS_LMV) {
      const fecha = getDateForSlot(trimestre, s, dia);
      if (!fecha) continue;
      const enMes =
        fecha.getFullYear() === mesActivo.year &&
        fecha.getMonth() === mesActivo.monthIdx;
      if (enMes) alMenosUnoEnMes = true;
      celdas.push({ fecha, enMesActivo: enMes, semana: s, dia });
    }
    if (alMenosUnoEnMes) {
      filas.push({ semana: s, celdas });
    }
  }

  const handlePrev = () => {
    setMesIdxNav((i) => Math.max(0, i - 1));
  };
  const handleNext = () => {
    setMesIdxNav((i) =>
      Math.min(mesesDelTrimestre.length - 1, i + 1),
    );
  };

  return (
    <div className="space-y-3">
      {/* Navegador de mes */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handlePrev}
            disabled={mesIdxNav === 0}
            aria-label="Mes anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[180px] text-center text-base font-semibold text-slate-800">
            {mesActivo.nombre} {mesActivo.year}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={handleNext}
            disabled={mesIdxNav === mesesDelTrimestre.length - 1}
            aria-label="Mes siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="text-xs text-slate-500">
          {filas.length} semana{filas.length === 1 ? "" : "s"} ·{" "}
          {slots.length} slot{slots.length === 1 ? "" : "s"} en el trimestre
        </div>
      </div>

      {/* Header L-V */}
      <div className="grid grid-cols-5 gap-1.5 text-xs font-semibold text-slate-600 uppercase">
        {COLUMNAS_HEADER.map((c) => (
          <div key={c.code} className="px-1">
            {c.label}
          </div>
        ))}
      </div>

      {/* Grilla: una fila por semana del trimestre que toca el mes activo */}
      <div className="space-y-1.5">
        {filas.length === 0 ? (
          <div className="rounded border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
            Este mes no tiene semanas dentro del trimestre {trimestre}.
          </div>
        ) : (
          filas.map((fila) => (
            <div key={fila.semana} className="relative">
              <div
                className="absolute -left-9 top-1 text-[10px] font-semibold uppercase text-slate-400"
                aria-hidden
              >
                S{fila.semana}
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {fila.celdas.map((c) => {
                  const key = `${c.semana}-${c.dia}`;
                  const motivo = c.enMesActivo
                    ? festivoMap.get(key) ?? null
                    : null;
                  const slotsCelda = c.enMesActivo
                    ? slotsByCell.get(key) ?? []
                    : [];
                  return (
                    <CalendarioMensualCelda
                      key={key}
                      fecha={c.fecha}
                      enMesActivo={c.enMesActivo}
                      festivoMotivo={motivo}
                      slots={slotsCelda}
                      slotsVisibles={slotsVisibles}
                      slotsHighlighted={slotsHighlighted}
                      onClickSlot={onClickSlot}
                    />
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
