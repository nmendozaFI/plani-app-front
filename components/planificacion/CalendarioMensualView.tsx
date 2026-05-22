"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import type { Festivo, SlotCalendario } from "@/types/calendario";
import {
  getDateForSlot,
  mesDeLaSemana,
  primeraSemanaDelMes,
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
  /**
   * V26 (fixes post-validación): semana seleccionada en el page. Determina el
   * mes visible (lunes de la semana → mes) y la fila resaltada en la grilla.
   * El View no mantiene estado propio de "mes visible" — todo deriva de acá.
   */
  semanaActual: number;
  /** Callback emitido al navegar con las flechas ← →. El page sincroniza el
   *  selector S1-S12 y la vista lista. */
  onSemanaChange: (semana: number) => void;
  onClickSlot: (slot: SlotCalendario) => void;
  /** V26 (Paso 4): click en botón "+ HH:MM" de una franja libre. */
  onCreateClick: (params: {
    semana: number;
    dia: string;
    horario: string;
    tipoSugerido: "EF" | "IT" | null;
  }) => void;
}

const DIAS_LMV = ["L", "M", "X", "J", "V"] as const;

const COLUMNAS_HEADER = [
  { code: "L", label: "Lunes" },
  { code: "M", label: "Martes" },
  { code: "X", label: "Miércoles" },
  { code: "J", label: "Jueves" },
  { code: "V", label: "Viernes" },
];

const MONTHS_FULL = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/**
 * V26 — Vista calendario mensual de la página Operación. Pinta una grilla
 * L-V × ~4-5 semanas para el mes derivado de `semanaActual`, con mini-cards
 * de los slots en cada celda.
 *
 * Es un componente "controlado": no tiene estado propio para "qué mes mostrar".
 * El page client mantiene `semanaActual` como única fuente de verdad y el View
 * la usa tanto para resaltar la fila correspondiente como para calcular el
 * mes visible. Las flechas ← → emiten `onSemanaChange` con la primera semana
 * del mes destino (o quedan deshabilitadas si ese mes cae fuera del trimestre).
 */
export function CalendarioMensualView({
  trimestre,
  slots,
  festivos,
  slotsVisibles,
  slotsHighlighted,
  semanaActual,
  onSemanaChange,
  onClickSlot,
  onCreateClick,
}: Props) {
  const mesActivo = useMemo(
    () => mesDeLaSemana(trimestre, semanaActual),
    [trimestre, semanaActual],
  );

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

  // Calcular semana destino de cada flecha. Si el mes destino no tiene ningún
  // lunes dentro del trimestre, devolvemos null y la flecha se deshabilita.
  const semanaMesAnterior = useMemo(() => {
    if (!mesActivo) return null;
    const prevMonthIdx = mesActivo.monthIdx === 0 ? 11 : mesActivo.monthIdx - 1;
    const prevYear = mesActivo.monthIdx === 0 ? mesActivo.year - 1 : mesActivo.year;
    return primeraSemanaDelMes(trimestre, prevYear, prevMonthIdx);
  }, [trimestre, mesActivo]);

  const semanaMesSiguiente = useMemo(() => {
    if (!mesActivo) return null;
    const nextMonthIdx = mesActivo.monthIdx === 11 ? 0 : mesActivo.monthIdx + 1;
    const nextYear = mesActivo.monthIdx === 11 ? mesActivo.year + 1 : mesActivo.year;
    return primeraSemanaDelMes(trimestre, nextYear, nextMonthIdx);
  }, [trimestre, mesActivo]);

  if (!mesActivo) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
        No hay meses calculables para este trimestre.
      </div>
    );
  }

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
    if (semanaMesAnterior != null) onSemanaChange(semanaMesAnterior);
  };
  const handleNext = () => {
    if (semanaMesSiguiente != null) onSemanaChange(semanaMesSiguiente);
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
            disabled={semanaMesAnterior == null}
            aria-label="Mes anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[180px] text-center text-base font-semibold text-slate-800">
            {MONTHS_FULL[mesActivo.monthIdx]} {mesActivo.year}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={handleNext}
            disabled={semanaMesSiguiente == null}
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
          filas.map((fila) => {
            const esSemanaActual = fila.semana === semanaActual;
            return (
              <div key={fila.semana} className="relative">
                <div
                  className={`absolute -left-9 top-1 text-[10px] font-semibold uppercase ${
                    esSemanaActual
                      ? "text-amber-600 font-bold"
                      : "text-slate-400"
                  }`}
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
                        semana={c.semana}
                        dia={c.dia}
                        enMesActivo={c.enMesActivo}
                        festivoMotivo={motivo}
                        slots={slotsCelda}
                        slotsVisibles={slotsVisibles}
                        slotsHighlighted={slotsHighlighted}
                        enSemanaResaltada={esSemanaActual}
                        onClickSlot={onClickSlot}
                        onCreateClick={onCreateClick}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
