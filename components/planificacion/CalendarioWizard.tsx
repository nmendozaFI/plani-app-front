/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useCallback, useMemo } from "react";
import {
  actionGenerarCalendario,
  actionObtenerCalendario,
  actionImportarExcelCalendario,
} from "@/actions/calendario-actions";
import { usePlanningStatus } from "@/hooks/use-planning-status";
import type { CalendarioOutput, SlotCalendario, ImportarExcelResult } from "@/lib/api";
import { WarningsPanel } from "./WarningsPanel";

// ── Constants ────────────────────────────────────────────────

const DIAS_ORDEN = ["L", "M", "X", "J", "V"] as const;
const DIAS_LABEL: Record<string, string> = {
  L: "Lunes", M: "Martes", X: "Miércoles", J: "Jueves", V: "Viernes",
};
const HORARIOS_LJ = ["09:30-11:30", "12:00-14:00", "15:00-17:00"];
const HORARIOS_V = ["09:30-11:30", "12:00-14:00"];

function getHorariosForDia(dia: string) {
  return dia === "V" ? HORARIOS_V : HORARIOS_LJ;
}

// ── Colors ───────────────────────────────────────────────────

const EMPRESA_COLORS: Record<number, { bg: string; border: string; text: string; dot: string }> = {
  1:  { bg: "bg-blue-50",    border: "border-blue-200",    text: "text-blue-800",    dot: "bg-blue-500" },
  2:  { bg: "bg-indigo-50",  border: "border-indigo-200",  text: "text-indigo-800",  dot: "bg-indigo-500" },
  3:  { bg: "bg-red-50",     border: "border-red-200",     text: "text-red-800",     dot: "bg-red-500" },
  4:  { bg: "bg-amber-50",   border: "border-amber-200",   text: "text-amber-800",   dot: "bg-amber-500" },
  5:  { bg: "bg-yellow-50",  border: "border-yellow-200",  text: "text-yellow-800",  dot: "bg-yellow-500" },
  6:  { bg: "bg-purple-50",  border: "border-purple-200",  text: "text-purple-800",  dot: "bg-purple-500" },
  7:  { bg: "bg-sky-50",     border: "border-sky-200",     text: "text-sky-800",     dot: "bg-sky-500" },
  8:  { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-800", dot: "bg-emerald-500" },
  9:  { bg: "bg-stone-50",   border: "border-stone-300",   text: "text-stone-700",   dot: "bg-stone-500" },
  10: { bg: "bg-teal-50",    border: "border-teal-200",    text: "text-teal-800",    dot: "bg-teal-500" },
};

function getColor(id: number | null) {
  if (id === 0 || id === null) return { bg: "bg-amber-50/80", border: "border-dashed border-amber-300", text: "text-amber-600", dot: "bg-amber-400" };
  return EMPRESA_COLORS[id % 10 || 10] ?? { bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-700", dot: "bg-slate-400" };
}

// ── Helpers ──────────────────────────────────────────────────

/** Normaliza: vacantes tienen empresa_id=null o 0, o estado VACANTE */
function isVacante(slot: SlotCalendario): boolean {
  return slot.empresa_id === 0 || slot.empresa_id === null || slot.estado === "VACANTE";
}

// ── Types ────────────────────────────────────────────────────

type Vista = "semanal" | "lista" | "empresa";
type Paso = "config" | "resultado";
type FiltroVacante = "todas" | "asignadas" | "vacantes";


// ══════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════

export function CalendarioWizard() {
  const { status, loading: loadingStatus } = usePlanningStatus();
  const trimestre = status?.trimestre_a_planificar || null;
  const esPlanificandoActivo = status?.activo_necesita_planificacion || false;
  const tieneFrequencias = esPlanificandoActivo
    ? status?.activo_tiene_frecuencias
    : status?.siguiente_tiene_frecuencias;

  const [paso, setPaso] = useState<Paso>("config");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vista, setVista] = useState<Vista>("semanal");
  const [calendario, setCalendario] = useState<CalendarioOutput | null>(null);
  const [slotSel, setSlotSel] = useState<SlotCalendario | null>(null);
  const [filtroVacante, setFiltroVacante] = useState<FiltroVacante>("todas");
  const [semanaSeleccionada, setSemanaSeleccionada] = useState<number | null>(null);

  // Import Excel
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportarExcelResult | null>(null);

  const handleGenerar = useCallback(async () => {
    if (!trimestre) return;
    setLoading(true); setError(null);
    try {
      const result = await actionGenerarCalendario(trimestre);
      if (!result.ok) throw new Error(result.error);
      setCalendario(result.data); setPaso("resultado");
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [trimestre]);

  const handleCargar = useCallback(async () => {
    if (!trimestre) return;
    setLoading(true); setError(null);
    try {
      const result = await actionObtenerCalendario(trimestre);
      if (!result.ok) throw new Error(result.error);
      const data = result.data;
      if (!data || data.total_slots === 0) throw new Error("No hay calendario para este trimestre");
      setCalendario({
        trimestre: data.trimestre, status: "CARGADO", tiempo_segundos: 0,
        total_slots: data.total_slots,
        total_ef: data.slots.filter((s: any) => s.programa === "EF").length,
        total_it: data.slots.filter((s: any) => s.programa === "IT").length,
        slots: data.slots, inviolables_pct: 100, preferentes_pct: 100, warnings: [],
      });
      setPaso("resultado");
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [trimestre]);

  const handleExport = useCallback(async () => {
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${API}/api/calendario/${trimestre}/exportar-excel`, { method: "POST" });
      if (!res.ok) throw new Error("Error al exportar");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `calendario_${trimestre}.xlsx`;
      a.click();
    } catch (e: any) { setError(e.message); }
  }, [trimestre]);

  const handleImportFile = useCallback(async (file: File) => {
    if (!trimestre) return;
    setImporting(true);
    setImportResult(null);
    setError(null);
    try {
      const result = await actionImportarExcelCalendario(trimestre, file, false);
      if (!result.ok) throw new Error(result.error);
      setImportResult(result.data);
      // Reload calendario after import
      if (result.data.actualizados > 0) {
        const calResult = await actionObtenerCalendario(trimestre);
        if (calResult.ok) {
          setCalendario({
            trimestre: calResult.data.trimestre, status: "IMPORTADO", tiempo_segundos: 0,
            total_slots: calResult.data.total_slots,
            total_ef: calResult.data.slots.filter((s: any) => s.programa === "EF").length,
            total_it: calResult.data.slots.filter((s: any) => s.programa === "IT").length,
            slots: calResult.data.slots, inviolables_pct: 100, preferentes_pct: 100, warnings: [],
          });
        }
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setImporting(false);
    }
  }, [trimestre]);

  // ── Stats ───────────────────────────────────────────────────

  const stats = useMemo(() => {
    if (!calendario) return null;
    const slots = calendario.slots;

    const totalVacantes = slots.filter(isVacante).length;
    const totalAsignados = slots.filter((s) => !isVacante(s)).length;

    const porEmpresa: Record<number, { nombre: string; ef: number; it: number; ciudades: Set<string> }> = {};
    for (const s of slots) {
      if (isVacante(s) || s.empresa_id === null) continue; // No contar vacantes como "empresa"
      const eid = s.empresa_id;
      if (!porEmpresa[eid])
        porEmpresa[eid] = { nombre: s.empresa_nombre ?? "", ef: 0, it: 0, ciudades: new Set() };
      if (s.programa === "EF") porEmpresa[eid].ef++;
      else porEmpresa[eid].it++;
      if (s.ciudad) porEmpresa[eid].ciudades.add(s.ciudad);
    }

    // Vacantes por semana para el mini-mapa
    const vacantesPorSemana: Record<number, number> = {};
    for (const s of slots) {
      if (isVacante(s)) {
        vacantesPorSemana[s.semana] = (vacantesPorSemana[s.semana] || 0) + 1;
      }
    }

    const meses = [
      { label: "Mes 1", semanas: [1, 2, 3, 4] },
      { label: "Mes 2", semanas: [5, 6, 7, 8] },
      { label: "Mes 3", semanas: [9, 10, 11, 12, 13] },
    ];
    const porMes = meses.map((m) => {
      const mesSlots = slots.filter((s) => m.semanas.includes(s.semana));
      return {
        ...m,
        total: mesSlots.length,
        ef: mesSlots.filter((s) => s.programa === "EF" && !isVacante(s)).length,
        it: mesSlots.filter((s) => s.programa === "IT" && !isVacante(s)).length,
        vacantes: mesSlots.filter(isVacante).length,
      };
    });

    return { porEmpresa, porMes, totalVacantes, totalAsignados, vacantesPorSemana };
  }, [calendario]);

  // Semanas únicas
  const semanas = useMemo(() => {
    if (!calendario) return [];
    const set = new Set(calendario.slots.map((s) => s.semana));
    return Array.from(set).sort((a, b) => a - b);
  }, [calendario]);

  // Slots filtrados
  const slotsFiltrados = useMemo(() => {
    if (!calendario) return [];
    let filtered = calendario.slots;
    if (filtroVacante === "vacantes") filtered = filtered.filter(isVacante);
    if (filtroVacante === "asignadas") filtered = filtered.filter((s) => !isVacante(s));
    if (semanaSeleccionada !== null) filtered = filtered.filter((s) => s.semana === semanaSeleccionada);
    return filtered;
  }, [calendario, filtroVacante, semanaSeleccionada]);

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Fase 2 — Calendario</h1>
          <p className="text-sm text-slate-500 mt-0.5">20 talleres/semana · 14 EF + 6 IT · 13 semanas</p>
        </div>
        {paso !== "config" && (
          <button onClick={() => { setPaso("config"); setCalendario(null); setError(null); setFiltroVacante("todas"); setSemanaSeleccionada(null); }}
            className="text-sm text-slate-500 hover:text-slate-700 underline underline-offset-2">← Volver</button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* ═══ CONFIG ═══ */}
      {paso === "config" && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {loadingStatus ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Spinner />
              Cargando configuracion...
            </div>
          ) : trimestre ? (
            <>
              <h2 className="text-sm font-semibold text-slate-700 mb-4">Generar calendario</h2>

              {/* Info banner when planning the activo trimestre */}
              {esPlanificandoActivo && (
                <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <p className="text-sm text-blue-700">
                    <strong>Nota:</strong> Generando calendario para el trimestre activo ({trimestre}).
                    Una vez completado, podras operarlo desde la pagina de Operacion.
                  </p>
                </div>
              )}

              {/* Warning if no frecuencias */}
              {!tieneFrequencias && (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm text-amber-700">
                    <strong>Atencion:</strong> El trimestre {trimestre} no tiene frecuencias confirmadas.
                    Debes completar la <a href="/planificacion/frecuencias" className="font-medium underline">Fase 1 (Frecuencias)</a> primero.
                  </p>
                </div>
              )}

              <div className="flex items-end gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Trimestre a Planificar</label>
                  <div className={`rounded-lg border px-4 py-2 ${
                    esPlanificandoActivo
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-blue-200 bg-blue-50"
                  }`}>
                    <span className={`text-lg font-bold ${
                      esPlanificandoActivo ? "text-emerald-800" : "text-blue-800"
                    }`}>{trimestre}</span>
                    <span className={`ml-2 text-xs ${
                      esPlanificandoActivo ? "text-emerald-600" : "text-blue-600"
                    }`}>({esPlanificandoActivo ? "activo" : "siguiente"})</span>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-400">Requiere frecuencias confirmadas (Fase 1). Cada semana genera 20 slots fijos.</p>
              <div className="mt-5 flex gap-3">
                <button onClick={handleGenerar} disabled={loading || !tieneFrequencias}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? <><Spinner />Generando...</> : "Generar calendario"}
                </button>
                <button onClick={handleCargar} disabled={loading}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50">
                  Cargar existente
                </button>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <h3 className="text-sm font-semibold text-amber-800 mb-2">
                No hay trimestre para planificar
              </h3>
              <p className="text-sm text-amber-700">
                {status?.activo_tiene_frecuencias && status?.activo_tiene_calendario
                  ? "El trimestre activo ya tiene calendario. Configura el trimestre siguiente desde el Dashboard para continuar."
                  : "Configura el trimestre desde el Dashboard para poder generar el calendario."}
              </p>
              <a
                href="/dashboard"
                className="mt-3 inline-block text-sm font-medium text-amber-800 underline underline-offset-2 hover:text-amber-900"
              >
                Ir al Dashboard
              </a>
            </div>
          )}
        </div>
      )}

      {/* ═══ RESULTADO ═══ */}
      {paso === "resultado" && calendario && stats && (
        <>
          {/* ── Stats row ─────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
            <MiniStat label="Status" value={calendario.status} color={calendario.status === "OPTIMAL" ? "emerald" : "amber"} />
            <MiniStat label="Tiempo" value={`${calendario.tiempo_segundos}s`} />
            <MiniStat label="EF" value={`${calendario.total_ef}`} sub={`/ ${13 * 14}`} color="slate" />
            <MiniStat label="IT" value={`${calendario.total_it}`} sub={`/ ${13 * 6}`} color="slate" />
            <MiniStat label="Asignados" value={`${stats.totalAsignados}`} sub={`/ ${calendario.slots.length}`} color="emerald" />
            <MiniStat label="Vacantes" value={`${stats.totalVacantes}`} color={stats.totalVacantes > 0 ? "amber" : "emerald"}
              icon={stats.totalVacantes > 0 ? "⚠" : "✓"} />
          </div>

          {/* ── Vacantes heatmap (si hay vacantes) ────────────── */}
          {stats.totalVacantes > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-[10px]">⚠</span>
                  <span className="text-sm font-semibold text-amber-800">
                    {stats.totalVacantes} vacante{stats.totalVacantes !== 1 ? "s" : ""} por cubrir
                  </span>
                </div>
                <span className="text-[10px] text-amber-600">Click en semana para filtrar</span>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {semanas.map((sem) => {
                  const vac = stats.vacantesPorSemana[sem] || 0;
                  const isActive = semanaSeleccionada === sem;
                  return (
                    <button
                      key={sem}
                      onClick={() => setSemanaSeleccionada(isActive ? null : sem)}
                      className={`flex flex-col items-center rounded-lg px-2 py-1.5 text-[10px] transition-all border ${
                        isActive
                          ? "border-amber-400 bg-amber-200 shadow-sm"
                          : vac > 0
                            ? "border-amber-200 bg-amber-100/80 hover:bg-amber-200/80"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <span className={`font-bold ${vac > 0 ? "text-amber-800" : "text-slate-500"}`}>S{sem}</span>
                      {vac > 0 && (
                        <span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[8px] font-bold text-white">
                          {vac}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Monthly breakdown ─────────────────────────────── */}
          <div className="flex gap-3">
            {stats.porMes.map((m) => (
              <div key={m.label} className="flex-1 rounded-lg border border-slate-200 bg-white p-3">
                <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{m.label}</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-lg font-bold text-slate-800">{m.total}</span>
                  {m.vacantes > 0 && (
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">
                      {m.vacantes} vac.
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400">{m.ef} EF · {m.it} IT</div>
              </div>
            ))}
          </div>

          <WarningsPanel warnings={calendario.warnings} />

          {/* ── Controls: vista + filtros + export ────────────── */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              {/* Vista selector */}
              <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
                {(["semanal", "lista", "empresa"] as Vista[]).map((v) => (
                  <button key={v} onClick={() => setVista(v)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      vista === v ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-700"
                    }`}>
                    {v === "semanal" ? "Semanal" : v === "lista" ? "Lista" : "Por empresa"}
                  </button>
                ))}
              </div>

              {/* Filtro vacantes */}
              <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
                {([
                  { key: "todas", label: "Todas" },
                  { key: "asignadas", label: "Asignadas" },
                  { key: "vacantes", label: `Vacantes${stats.totalVacantes > 0 ? ` (${stats.totalVacantes})` : ""}` },
                ] as { key: FiltroVacante; label: string }[]).map(({ key, label }) => (
                  <button key={key} onClick={() => setFiltroVacante(key)}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      filtroVacante === key
                        ? key === "vacantes"
                          ? "bg-amber-500 text-white"
                          : "bg-slate-900 text-white"
                        : "text-slate-500 hover:text-slate-700"
                    }`}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Clear semana filter */}
              {semanaSeleccionada !== null && (
                <button
                  onClick={() => setSemanaSeleccionada(null)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
                >
                  Semana {semanaSeleccionada}
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50 cursor-pointer">
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImportFile(file);
                  e.target.value = "";
                }}
                disabled={importing}
              />
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              {importing ? "Importando..." : "Importar Excel"}
            </label>
            <button onClick={handleExport}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Exportar Excel
            </button>
          </div>

          {/* Import Result Toast */}
          {importResult && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 flex items-start justify-between">
              <div>
                <h4 className="text-sm font-semibold text-blue-800 mb-1">
                  {importResult.actualizados > 0 ? `${importResult.actualizados} slots actualizados` : "Sin cambios"}
                </h4>
                <p className="text-xs text-blue-600">
                  {importResult.total_procesados} filas procesadas
                  {importResult.errores > 0 && `, ${importResult.errores} errores`}
                  {importResult.empresas_cambiadas.length > 0 && `, ${importResult.empresas_cambiadas.length} empresas cambiadas`}
                </p>
                {importResult.warnings.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-xs text-amber-700 cursor-pointer">
                      {importResult.warnings.length} advertencias
                    </summary>
                    <ul className="mt-1 text-xs text-amber-600 pl-4 list-disc">
                      {importResult.warnings.slice(0, 5).map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  </details>
                )}
              </div>
              <button onClick={() => setImportResult(null)} className="text-blue-400 hover:text-blue-600">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* ═══ VISTA SEMANAL ═══ */}
          {vista === "semanal" && (
            <div className="space-y-4">
              {semanas
                .filter((sem) => semanaSeleccionada === null || sem === semanaSeleccionada)
                .map((sem) => {
                  const slotsOfWeek = slotsFiltrados.filter((s) => s.semana === sem);
                  const vacantesEnSemana = calendario.slots.filter((s) => s.semana === sem && isVacante(s)).length;

                  if (slotsOfWeek.length === 0 && filtroVacante !== "todas") return null;

                  return (
                    <div key={sem} className={`rounded-xl border bg-white shadow-sm overflow-hidden ${
                      vacantesEnSemana > 0 ? "border-amber-200" : "border-slate-200"
                    }`}>
                      <div className={`flex items-center justify-between border-b px-4 py-2 ${
                        vacantesEnSemana > 0 ? "border-amber-100 bg-amber-50/60" : "border-slate-100 bg-slate-50/80"
                      }`}>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-600">Semana {sem}</span>
                          <span className="text-[10px] text-slate-400">{slotsOfWeek.length} talleres</span>
                        </div>
                        {vacantesEnSemana > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                            {vacantesEnSemana} vacante{vacantesEnSemana > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr>
                              <th className="w-24 px-2 py-1.5 text-[10px] font-semibold text-slate-400 text-left border-b border-slate-100">Horario</th>
                              {DIAS_ORDEN.map((d) => (
                                <th key={d} className="px-1 py-1.5 text-[10px] font-semibold text-slate-400 text-center border-b border-slate-100">
                                  {DIAS_LABEL[d]}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {HORARIOS_LJ.map((h) => (
                              <tr key={h} className="border-b border-slate-50">
                                <td className="px-2 py-1 text-[10px] font-mono text-slate-500 align-top whitespace-nowrap">{h}</td>
                                {DIAS_ORDEN.map((d) => {
                                  const horariosDelDia = getHorariosForDia(d);
                                  if (!horariosDelDia.includes(h)) {
                                    return <td key={d} className="px-1 py-1 bg-slate-50/50" />;
                                  }
                                  // Buscar en slotsFiltrados para esta semana
                                  const slot = slotsFiltrados.find(
                                    (s) => s.semana === sem && s.dia === d && s.horario === h
                                  );
                                  // Si no está en filtrados pero sí existe en el calendario, slot oculto por filtro
                                  const slotExists = calendario.slots.find(
                                    (s) => s.semana === sem && s.dia === d && s.horario === h
                                  );
                                  if (!slot && slotExists && filtroVacante !== "todas") {
                                    return (
                                      <td key={d} className="px-1 py-1">
                                        <div className="rounded border border-dashed border-slate-200 bg-slate-50/30 p-1.5 text-center text-[9px] text-slate-300">
                                          filtrado
                                        </div>
                                      </td>
                                    );
                                  }
                                  if (!slot) {
                                    return (
                                      <td key={d} className="px-1 py-1">
                                        <div className="rounded border border-dashed border-slate-200 bg-slate-50/30 p-1.5 text-center text-[9px] text-slate-300">
                                          vacío
                                        </div>
                                      </td>
                                    );
                                  }
                                  return (
                                    <td key={d} className="px-1 py-1">
                                      <SlotCard slot={slot} onClick={() => setSlotSel(slot)} />
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })
                .filter(Boolean)}
            </div>
          )}

          {/* ═══ VISTA LISTA ═══ */}
          {vista === "lista" && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Sem</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Día</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Horario</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Empresa</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600">Prog.</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Taller</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Ciudad</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {slotsFiltrados.map((s, i) => {
                    const vacant = isVacante(s);
                    const c = getColor(s.empresa_id);
                    return (
                      <tr key={i} onClick={() => setSlotSel(s)}
                        className={`cursor-pointer transition-colors ${
                          vacant
                            ? "bg-amber-50/60 hover:bg-amber-100/60"
                            : "hover:bg-slate-50"
                        }`}>
                        <td className="px-3 py-2 font-mono text-xs text-slate-500">{s.semana}</td>
                        <td className="px-3 py-2 text-xs">{DIAS_LABEL[s.dia]}</td>
                        <td className="px-3 py-2 text-xs font-mono text-slate-600">{s.horario}</td>
                        <td className="px-3 py-2">
                          {vacant ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600">
                              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                              — Vacante —
                            </span>
                          ) : (
                            <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${c.text}`}>
                              <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                              {s.empresa_nombre}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={`text-[10px] font-bold rounded px-1.5 py-0.5 ${
                            s.programa === "EF" ? "bg-slate-200 text-slate-600" : "bg-violet-200 text-violet-700"
                          }`}>{s.programa}</span>
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-600 max-w-45 truncate">{s.taller_nombre}</td>
                        <td className="px-3 py-2 text-xs text-slate-500">{s.ciudad || "—"}</td>
                        <td className="px-3 py-2 text-center">
                          {vacant ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                              Vacante
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                              Asignado
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {slotsFiltrados.length === 0 && (
                <div className="py-12 text-center text-sm text-slate-400">
                  No hay slots con el filtro actual
                </div>
              )}
            </div>
          )}

          {/* ═══ VISTA POR EMPRESA ═══ */}
          {vista === "empresa" && (
            <div className="space-y-6">
              {/* Vacantes card (si hay y filtro lo permite) */}
              {(filtroVacante === "todas" || filtroVacante === "vacantes") && stats.totalVacantes > 0 && (
                <div className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/50 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-200 text-xs">⚠</span>
                      <span className="font-semibold text-amber-800">Vacantes ({stats.totalVacantes})</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {slotsFiltrados.filter(isVacante).map((s, i) => (
                      <div key={i} onClick={() => setSlotSel(s)}
                        className="flex items-center justify-between rounded-md bg-white/80 border border-amber-200 px-3 py-2 text-xs cursor-pointer hover:bg-white transition-colors">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-amber-700 font-semibold">S{s.semana}</span>
                          <span className="text-slate-600">{DIAS_LABEL[s.dia]} · {s.horario}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold rounded px-1.5 py-0.5 ${
                            s.programa === "EF" ? "bg-slate-200 text-slate-600" : "bg-violet-200 text-violet-700"
                          }`}>{s.programa}</span>
                          <span className="text-slate-500 truncate max-w-40">{s.taller_nombre}</span>
                          {s.sugerencias && s.sugerencias.length > 0 && (
                            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">
                              {s.sugerencias.length} sug.
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empresas grid */}
              {(filtroVacante === "todas" || filtroVacante === "asignadas") && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {Object.entries(stats.porEmpresa)
                    .sort(([, a], [, b]) => (b.ef + b.it) - (a.ef + a.it))
                    .map(([eid, emp]) => {
                      const c = getColor(parseInt(eid));
                      const empSlots = slotsFiltrados.filter((s) => s.empresa_id === parseInt(eid));
                      if (empSlots.length === 0) return null;
                      return (
                        <div key={eid} className={`rounded-xl border ${c.border} ${c.bg} p-4`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`h-3 w-3 rounded-full ${c.dot}`} />
                              <span className={`font-semibold ${c.text}`}>{emp.nombre}</span>
                            </div>
                            <span className={`text-lg font-bold ${c.text}`}>{emp.ef + emp.it}</span>
                          </div>
                          <div className="mt-2 flex gap-3 text-xs">
                            <span className="text-slate-600">{emp.ef} EF</span>
                            <span className="text-violet-600">{emp.it} IT</span>
                            <span className="text-slate-400">{Array.from(emp.ciudades).join(", ")}</span>
                          </div>
                          <div className="mt-3 space-y-1">
                            {empSlots.map((s, i) => (
                              <div key={i} onClick={() => setSlotSel(s)}
                                className="flex items-center justify-between rounded-md bg-white/60 px-2 py-1 text-[11px] cursor-pointer hover:bg-white transition-colors">
                                <span className="text-slate-600">
                                  S{s.semana} · {DIAS_LABEL[s.dia]} · {s.horario}
                                </span>
                                <span className="text-slate-500 truncate ml-2 max-w-35">{s.taller_nombre}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })
                    .filter(Boolean)}
                </div>
              )}
            </div>
          )}

          {/* Modal */}
          {slotSel && <SlotModal slot={slotSel} onClose={() => setSlotSel(null)} />}
        </>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════
// SlotCard (grid cell)
// ══════════════════════════════════════════════════════════════

function SlotCard({ slot, onClick }: { slot: SlotCalendario; onClick: () => void }) {
  const vacant = isVacante(slot);
  const c = getColor(slot.empresa_id);

  if (vacant) {
    return (
      <button onClick={onClick}
        className="w-full rounded-md border-2 border-dashed border-amber-300 bg-amber-50/80 p-1.5 text-left transition-all hover:shadow-sm hover:bg-amber-100/80 group">
        <div className="flex items-center gap-1 text-amber-600">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-[11px] font-semibold">Vacante</span>
        </div>
        <div className="mt-0.5 flex items-center gap-1">
          <span className={`text-[9px] font-bold rounded px-1 py-px ${
            slot.programa === "EF" ? "bg-slate-200 text-slate-600" : "bg-violet-200 text-violet-700"
          }`}>{slot.programa}</span>
        </div>
        <div className="mt-0.5 text-[9px] text-amber-500 truncate">{slot.taller_nombre}</div>
        {slot.sugerencias && slot.sugerencias.length > 0 && (
          <div className="mt-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-[8px] text-emerald-600 font-medium">{slot.sugerencias.length} sugerencia{slot.sugerencias.length > 1 ? "s" : ""}</span>
          </div>
        )}
      </button>
    );
  }

  return (
    <button onClick={onClick}
      className={`w-full rounded-md border p-1.5 text-left transition-all hover:shadow-sm ${c.border} ${c.bg}`}>
      <div className={`flex items-center gap-1 ${c.text}`}>
        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${c.dot}`} />
        <span className="text-[11px] font-semibold truncate">{slot.empresa_nombre}</span>
      </div>
      <div className="mt-0.5 flex items-center gap-1">
        <span className={`text-[9px] font-bold rounded px-1 py-px ${
          slot.programa === "EF" ? "bg-slate-200 text-slate-600" : "bg-violet-200 text-violet-700"
        }`}>{slot.programa}</span>
      </div>
      <div className="mt-0.5 text-[9px] text-slate-400 truncate">{slot.taller_nombre}</div>
    </button>
  );
}


// ══════════════════════════════════════════════════════════════
// SlotModal — con sugerencias mejoradas
// ══════════════════════════════════════════════════════════════

function SlotModal({ slot, onClose }: { slot: SlotCalendario; onClose: () => void }) {
  const vacant = isVacante(slot);
  const c = getColor(slot.empresa_id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              {vacant ? (
                <>
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-xs">⚠</span>
                  <h3 className="text-lg font-bold text-amber-700">Slot vacante</h3>
                </>
              ) : (
                <>
                  <span className={`h-3 w-3 rounded-full ${c.dot}`} />
                  <h3 className={`text-lg font-bold ${c.text}`}>{slot.empresa_nombre}</h3>
                </>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Semana {slot.semana} · {DIAS_LABEL[slot.dia]} · {slot.horario}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Details */}
        <div className="mt-4 space-y-3">
          <Row label="Programa" value={slot.programa} badge={slot.programa === "EF" ? "slate" : "violet"} />
          <Row label="Taller" value={slot.taller_nombre} />
          <Row label="Horario" value={`${DIAS_LABEL[slot.dia]} · ${slot.horario}`} />
          <Row label="Turno" value={slot.turno || "—"} />
          <Row label="Ciudad" value={slot.ciudad || "Sin asignar"} />
          {!vacant && <Row label="Tipo" value={slot.tipo_asignacion} />}
        </div>

        {/* Sugerencias de reemplazo (mejoradas) */}
        {vacant && slot.sugerencias && slot.sugerencias.length > 0 && (
          <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700">✓</span>
              <h4 className="text-sm font-semibold text-emerald-800">Empresas sugeridas para cubrir</h4>
            </div>
            <div className="space-y-2">
              {slot.sugerencias.map((sug, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg bg-white border border-emerald-100 px-3 py-2.5 shadow-sm">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold shrink-0 ${
                    sug.prioridad === 1
                      ? "bg-emerald-500 text-white"
                      : sug.prioridad === 2
                        ? "bg-emerald-200 text-emerald-800"
                        : "bg-slate-200 text-slate-600"
                  }`}>{sug.prioridad}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-800">{sug.empresa_nombre}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{sug.motivo}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Vacante sin sugerencias */}
        {vacant && (!slot.sugerencias || slot.sugerencias.length === 0) && (
          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-center">
            <p className="text-sm text-slate-500">No hay comodines disponibles para este slot.</p>
            <p className="text-xs text-slate-400 mt-1">Completar manualmente en el Excel exportado.</p>
          </div>
        )}
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════

function Row({ label, value, badge }: { label: string; value: string; badge?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-500">{label}</span>
      {badge ? (
        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${
          badge === "violet" ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-700"
        }`}>{value}</span>
      ) : (
        <span className="text-sm font-medium text-slate-800">{value}</span>
      )}
    </div>
  );
}

function MiniStat({ label, value, sub, color, icon }: { label: string; value: string; sub?: string; color?: string; icon?: string }) {
  const cls = color === "emerald" ? "text-emerald-600" : color === "red" ? "text-red-600" : color === "amber" ? "text-amber-600" : "text-slate-800";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1">
        {icon && <span className="text-sm">{icon}</span>}
        <span className={`text-lg font-bold ${cls}`}>{value}</span>
        {sub && <span className="text-xs text-slate-400">{sub}</span>}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}