"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  actionObtenerCalendarioAnual,
  actionInicializarCalendarioAnual,
  actionActualizarSemanasConfigBatch,
  actionObtenerSemanaDetalle,
} from "@/actions/calendario-anual-actions";
import type { SemanaConfigOut, SemanaDetalleOut } from "@/types/taller";
import { Badge } from "@/components/ui/badge";

// ── Constants ────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR, CURRENT_YEAR + 1, CURRENT_YEAR + 2];

const MONTHS = [
  { name: "Enero", weeks: [1, 2, 3, 4, 5] },
  { name: "Febrero", weeks: [5, 6, 7, 8, 9] },
  { name: "Marzo", weeks: [9, 10, 11, 12, 13] },
  { name: "Abril", weeks: [14, 15, 16, 17] },
  { name: "Mayo", weeks: [18, 19, 20, 21, 22] },
  { name: "Junio", weeks: [23, 24, 25, 26] },
  { name: "Julio", weeks: [27, 28, 29, 30, 31] },
  { name: "Agosto", weeks: [31, 32, 33, 34, 35] },
  { name: "Septiembre", weeks: [36, 37, 38, 39] },
  { name: "Octubre", weeks: [40, 41, 42, 43, 44] },
  { name: "Noviembre", weeks: [45, 46, 47, 48] },
  { name: "Diciembre", weeks: [49, 50, 51, 52] },
];

const QUARTERS = [
  { q: 1, label: "Q1", weeksRange: [1, 13] },
  { q: 2, label: "Q2", weeksRange: [14, 26] },
  { q: 3, label: "Q3", weeksRange: [27, 39] },
  { q: 4, label: "Q4", weeksRange: [40, 52] },
];

// ── Helpers ──────────────────────────────────────────────────

function getWeekDates(year: number, week: number): { start: Date; end: Date } {
  // ISO week date calculation
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7; // Monday=1
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dayOfWeek + 1 + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: monday, end: sunday };
}

function formatDateRange(start: Date, end: Date): string {
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const startDay = start.getDate();
  const startMonth = months[start.getMonth()];
  const endDay = end.getDate();
  const endMonth = months[end.getMonth()];

  if (start.getMonth() === end.getMonth()) {
    return `${startDay} - ${endDay} ${endMonth}`;
  }
  return `${startDay} ${startMonth} - ${endDay} ${endMonth}`;
}

function getMonthForWeek(week: number): string {
  for (const month of MONTHS) {
    if (month.weeks.includes(week)) {
      return month.name;
    }
  }
  return "";
}

// ── Types ────────────────────────────────────────────────────

interface LocalSemana {
  semana: number;
  tipo: "normal" | "intensiva";
  notas: string | null;
  extras_count: number;
  modified?: boolean;
}

// ── Component ────────────────────────────────────────────────

export function CalendarioAnualConfig() {
  const [anio, setAnio] = useState<number>(CURRENT_YEAR);
  const [semanas, setSemanas] = useState<SemanaConfigOut[]>([]);
  const [localSemanas, setLocalSemanas] = useState<LocalSemana[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Modes
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  // Week detail expansion
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);
  const [weekDetail, setWeekDetail] = useState<SemanaDetalleOut | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // ── Load data ──────────────────────────────────────────────

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await actionObtenerCalendarioAnual(anio);
      if (!result.ok) throw new Error(result.error);
      setSemanas(result.data);
      setInitialized(result.data.length > 0);
      // Reset local state when loading new data
      setLocalSemanas([]);
      setEditMode(false);
      setExpandedWeek(null);
      setWeekDetail(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al cargar datos";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [anio]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // ── Build full 52-week list ────────────────────────────────

  const fullSemanas = useMemo(() => {
    const semanaMap = new Map(semanas.map((s) => [s.semana, s]));
    const result: LocalSemana[] = [];
    for (let w = 1; w <= 52; w++) {
      const existing = semanaMap.get(w);
      if (existing) {
        result.push({
          semana: w,
          tipo: existing.tipo as "normal" | "intensiva",
          notas: existing.notas,
          extras_count: existing.extras_count,
        });
      } else {
        result.push({
          semana: w,
          tipo: "normal",
          notas: null,
          extras_count: 0,
        });
      }
    }
    return result;
  }, [semanas]);

  // ── Edit mode state ────────────────────────────────────────

  const currentSemanas = editMode && localSemanas.length > 0 ? localSemanas : fullSemanas;

  const enterEditMode = () => {
    setLocalSemanas(fullSemanas.map((s) => ({ ...s, modified: false })));
    setEditMode(true);
  };

  const cancelEdit = () => {
    setLocalSemanas([]);
    setEditMode(false);
  };

  const toggleWeekType = (semana: number) => {
    setLocalSemanas((prev) =>
      prev.map((s) =>
        s.semana === semana
          ? { ...s, tipo: s.tipo === "normal" ? "intensiva" : "normal", modified: true }
          : s
      )
    );
  };

  // ── Quick actions ──────────────────────────────────────────

  const markJulyAugustIntensive = () => {
    setLocalSemanas((prev) =>
      prev.map((s) =>
        s.semana >= 27 && s.semana <= 35
          ? { ...s, tipo: "intensiva", modified: true }
          : s
      )
    );
  };

  const markChristmasIntensive = () => {
    setLocalSemanas((prev) =>
      prev.map((s) =>
        s.semana >= 51 && s.semana <= 52
          ? { ...s, tipo: "intensiva", modified: true }
          : s
      )
    );
  };

  const markAllNormal = () => {
    setLocalSemanas((prev) =>
      prev.map((s) => ({ ...s, tipo: "normal", modified: true }))
    );
  };

  // ── Save changes ───────────────────────────────────────────

  const saveChanges = async () => {
    const modifiedWeeks = localSemanas.filter((s) => s.modified);
    if (modifiedWeeks.length === 0) {
      toast.info("No hay cambios para guardar");
      setEditMode(false);
      return;
    }

    setSaving(true);
    try {
      const updates = modifiedWeeks.map((s) => ({
        semana: s.semana,
        tipo: s.tipo,
        notas: s.notas,
      }));
      const result = await actionActualizarSemanasConfigBatch(anio, updates);
      if (!result.ok) throw new Error(result.error);
      toast.success(`Guardado: ${result.data.updated} semanas actualizadas`);
      await cargarDatos();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al guardar";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // ── Initialize year ────────────────────────────────────────

  const handleInitialize = async () => {
    setLoading(true);
    try {
      const result = await actionInicializarCalendarioAnual(anio);
      if (!result.ok) throw new Error(result.error);
      toast.success(result.data.message);
      await cargarDatos();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al inicializar";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Week detail expansion ──────────────────────────────────

  const toggleWeekExpansion = async (semana: number) => {
    if (expandedWeek === semana) {
      setExpandedWeek(null);
      setWeekDetail(null);
      return;
    }

    setExpandedWeek(semana);
    setLoadingDetail(true);
    try {
      const result = await actionObtenerSemanaDetalle(anio, semana);
      if (!result.ok) throw new Error(result.error);
      setWeekDetail(result.data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al cargar detalle";
      toast.error(msg);
      setExpandedWeek(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  // ── Quarter summary ────────────────────────────────────────

  const quarterSummary = useMemo(() => {
    return QUARTERS.map((q) => {
      const weeksInQ = currentSemanas.filter(
        (s) => s.semana >= q.weeksRange[0] && s.semana <= q.weeksRange[1]
      );
      const normales = weeksInQ.filter((s) => s.tipo === "normal").length;
      const intensivas = weeksInQ.filter((s) => s.tipo === "intensiva").length;
      const totalSlots = normales * 20 + intensivas * 15; // 20 normal, ~15 intensive
      return { ...q, normales, intensivas, totalSlots, totalWeeks: weeksInQ.length };
    });
  }, [currentSemanas]);

  const totalAnual = quarterSummary.reduce((sum, q) => sum + q.totalSlots, 0);
  const modifiedCount = localSemanas.filter((s) => s.modified).length;

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Calendario Anual de Talleres
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Configura que semanas son normales (20 slots) o intensivas (15 slots)
          </p>
        </div>
      </div>

      {/* Top bar */}
      <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-slate-600">Ano:</label>
          <select
            value={anio}
            onChange={(e) => setAnio(Number(e.target.value))}
            disabled={editMode}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {!initialized && (
            <button
              onClick={handleInitialize}
              disabled={loading}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              Inicializar ano
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!editMode ? (
            <button
              onClick={enterEditMode}
              disabled={loading || !initialized}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Editar
            </button>
          ) : (
            <>
              <button
                onClick={saveChanges}
                disabled={saving}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
              <button
                onClick={cancelEdit}
                disabled={saving}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
            </>
          )}
        </div>
      </div>

      {/* Edit mode indicator + quick actions */}
      {editMode && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-blue-800">Modo edicion</span>
              {modifiedCount > 0 && (
                <Badge className="bg-amber-100 text-amber-700">{modifiedCount} cambios sin guardar</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-blue-600 mr-2">Acciones rapidas:</span>
              <button
                onClick={markJulyAugustIntensive}
                className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100"
              >
                Jul-Ago intensivas
              </button>
              <button
                onClick={markChristmasIntensive}
                className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100"
              >
                Navidad intensiva
              </button>
              <button
                onClick={markAllNormal}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Todo normal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && !semanas.length && (
        <div className="flex items-center justify-center py-12">
          <Spinner />
          <span className="ml-2 text-sm text-slate-500">Cargando calendario...</span>
        </div>
      )}

      {/* Week list grouped by month */}
      {!loading && initialized && (
        <div className="space-y-6">
          {MONTHS.map((month) => {
            const uniqueWeeks = [...new Set(month.weeks)];
            const monthSemanas = uniqueWeeks
              .map((w) => currentSemanas.find((s) => s.semana === w))
              .filter((s): s is LocalSemana => s !== undefined);

            if (monthSemanas.length === 0) return null;

            return (
              <div key={month.name} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="bg-slate-100 px-4 py-2 border-b border-slate-200">
                  <span className="text-sm font-semibold text-slate-700">{month.name}</span>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-2 text-left w-16">Sem</th>
                      <th className="px-4 py-2 text-left w-48">Fechas</th>
                      <th className="px-4 py-2 text-left w-32">Tipo</th>
                      <th className="px-4 py-2 text-center w-20">Slots</th>
                      <th className="px-4 py-2 text-center w-24">Extras</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {monthSemanas.map((semana) => {
                      const dates = getWeekDates(anio, semana.semana);
                      const dateStr = formatDateRange(dates.start, dates.end);
                      const isIntensiva = semana.tipo === "intensiva";
                      const isExpanded = expandedWeek === semana.semana;
                      const isModified = semana.modified;
                      const slots = isIntensiva ? 15 : 20;

                      return (
                        <React.Fragment key={semana.semana}>
                          <tr
                            className={`transition-colors cursor-pointer ${
                              isIntensiva ? "bg-amber-50" : ""
                            } ${isModified ? "border-l-4 border-l-amber-400" : ""} hover:bg-slate-50`}
                            onClick={() => !editMode && toggleWeekExpansion(semana.semana)}
                          >
                            <td className="px-4 py-3 font-medium text-slate-700">
                              {semana.semana}
                            </td>
                            <td className="px-4 py-3 text-slate-600">{dateStr}</td>
                            <td className="px-4 py-3">
                              {editMode ? (
                                <div className="flex gap-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (semana.tipo !== "normal") toggleWeekType(semana.semana);
                                    }}
                                    className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                                      semana.tipo === "normal"
                                        ? "bg-emerald-600 text-white"
                                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                    }`}
                                  >
                                    Normal
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (semana.tipo !== "intensiva") toggleWeekType(semana.semana);
                                    }}
                                    className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                                      semana.tipo === "intensiva"
                                        ? "bg-amber-600 text-white"
                                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                    }`}
                                  >
                                    Intensiva
                                  </button>
                                </div>
                              ) : (
                                <span className={`inline-flex items-center gap-1.5 ${isIntensiva ? "text-amber-700" : "text-emerald-700"}`}>
                                  <span className={`h-2 w-2 rounded-full ${isIntensiva ? "bg-amber-500" : "bg-emerald-500"}`} />
                                  {isIntensiva ? "Intensiva" : "Normal"}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center font-medium text-slate-700">
                              {slots + (semana.extras_count || 0)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {semana.extras_count > 0 ? (
                                <Badge className="bg-purple-100 text-purple-700">+{semana.extras_count}</Badge>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                          </tr>

                          {/* Expanded detail */}
                          {isExpanded && !editMode && (
                            <tr>
                              <td colSpan={5} className="bg-blue-50 px-4 py-4 border-t border-blue-100">
                                {loadingDetail ? (
                                  <div className="flex items-center justify-center py-4">
                                    <Spinner />
                                    <span className="ml-2 text-sm text-slate-500">Cargando detalle...</span>
                                  </div>
                                ) : weekDetail ? (
                                  <WeekDetailView detail={weekDetail} />
                                ) : null}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      {/* Quarter summary */}
      {initialized && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Resumen por Trimestre</h3>
          <div className="space-y-2">
            {quarterSummary.map((q) => (
              <div key={q.q} className="flex items-center justify-between text-sm py-1 border-b border-slate-100 last:border-0">
                <div className="flex items-center gap-2">
                  <Badge className="bg-slate-100 text-slate-700">{q.label}</Badge>
                  <span className="text-slate-600">Sem {q.weeksRange[0]}-{q.weeksRange[1]}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-slate-600">
                    {q.normales > 0 && <span className="text-emerald-600">{q.normales} normales</span>}
                    {q.normales > 0 && q.intensivas > 0 && " + "}
                    {q.intensivas > 0 && <span className="text-amber-600">{q.intensivas} intensivas</span>}
                  </span>
                  <span className="font-medium text-slate-900">{q.totalSlots} slots</span>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <span className="font-semibold text-slate-700">Total anual</span>
              <span className="font-bold text-slate-900">{totalAnual} slots</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── WeekDetailView ───────────────────────────────────────────

function WeekDetailView({ detail }: { detail: SemanaDetalleOut }) {
  const efTalleres = detail.talleres.filter((t) => t.programa === "EF");
  const itTalleres = detail.talleres.filter((t) => t.programa === "IT");

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Badge className={detail.tipo === "intensiva" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}>
          {detail.tipo}
        </Badge>
        <span className="text-sm text-slate-600">{detail.resumen}</span>
      </div>
      <div className="grid grid-cols-2 gap-6">
        {/* EF */}
        <div>
          <div className="text-xs font-semibold text-blue-700 mb-2 flex items-center gap-1">
            <Badge className="bg-blue-100 text-blue-700">EF</Badge>
            <span>({detail.total_ef} talleres)</span>
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {efTalleres.map((t, i) => (
              <div key={`ef-${t.taller_id}-${i}`} className="text-xs text-slate-600 flex items-center gap-2 py-0.5">
                <span className="font-mono text-slate-400 w-6">{t.dia_semana}</span>
                <span className="text-slate-500 w-24">{t.horario}</span>
                <span className="text-slate-800 flex-1">{t.nombre}</span>
                {t.es_extra && <Badge className="bg-purple-100 text-purple-700 text-[9px] px-1">EXTRA</Badge>}
                {t.override && <Badge className="bg-blue-100 text-blue-700 text-[9px] px-1">MOVIDO</Badge>}
              </div>
            ))}
          </div>
        </div>
        {/* IT */}
        <div>
          <div className="text-xs font-semibold text-violet-700 mb-2 flex items-center gap-1">
            <Badge className="bg-violet-100 text-violet-700">IT</Badge>
            <span>({detail.total_it} talleres)</span>
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {itTalleres.map((t, i) => (
              <div key={`it-${t.taller_id}-${i}`} className="text-xs text-slate-600 flex items-center gap-2 py-0.5">
                <span className="font-mono text-slate-400 w-6">{t.dia_semana}</span>
                <span className="text-slate-500 w-24">{t.horario}</span>
                <span className="text-slate-800 flex-1">{t.nombre}</span>
                {t.es_extra && <Badge className="bg-purple-100 text-purple-700 text-[9px] px-1">EXTRA</Badge>}
                {t.override && <Badge className="bg-blue-100 text-blue-700 text-[9px] px-1">MOVIDO</Badge>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Spinner ──────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="h-5 w-5 animate-spin text-slate-400" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// Need React import for Fragment
import React from "react";
