"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  actionObtenerCalendario,
  actionActualizarSlot,
  actionActualizarSlotsBatch,
  actionObtenerResumen,
  actionImportarExcelCalendario,
} from "@/actions/calendario-actions";
import { useSettings } from "@/hooks/use-settings";
import { exportarExcel, obtenerEmpresas } from "@/lib/api";
import type {
  SlotCalendario,
  CalendarioGetResponse,
  CalendarioResumen,
  ImportarExcelResult,
} from "@/types/calendario";
import type { EmpresaSimple } from "@/types/empresa";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

// ── Constants ────────────────────────────────────────────────

const DIAS_ORDEN = ["L", "M", "X", "J", "V"] as const;
const DIAS_LABEL: Record<string, string> = {
  L: "Lunes", M: "Martes", X: "Miercoles", J: "Jueves", V: "Viernes",
};

const ESTADO_OPTIONS = ["Todos", "VACANTE", "PLANIFICADO", "CONFIRMADO", "OK", "CANCELADO"] as const;
const PROGRAMA_OPTIONS = ["Todos", "EF", "IT"] as const;

const ESTADO_CONFIG: Record<string, { bg: string; border: string; text: string; leftBorder: string }> = {
  VACANTE:     { bg: "bg-amber-50",   border: "border-amber-200", text: "text-amber-700",  leftBorder: "border-l-amber-400" },
  PLANIFICADO: { bg: "bg-white",      border: "border-slate-200", text: "text-slate-700",  leftBorder: "border-l-slate-300" },
  CONFIRMADO:  { bg: "bg-blue-50",    border: "border-blue-200",  text: "text-blue-700",   leftBorder: "border-l-blue-400" },
  OK:          { bg: "bg-green-50",   border: "border-green-200", text: "text-green-700",  leftBorder: "border-l-green-500" },
  CANCELADO:   { bg: "bg-red-50/50",  border: "border-red-200",   text: "text-red-600",    leftBorder: "border-l-red-400" },
};

// ── Date helpers ─────────────────────────────────────────────

function getWeekDateRange(trimestre: string, semana: number): string {
  const [yearStr, qStr] = trimestre.split("-Q");
  const year = parseInt(yearStr);
  const quarter = parseInt(qStr);

  // Q1=Jan, Q2=Apr, Q3=Jul, Q4=Oct
  const quarterStartMonth = (quarter - 1) * 3;
  const quarterStart = new Date(year, quarterStartMonth, 1);

  // Find first Monday of the quarter
  const dayOfWeek = quarterStart.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : (dayOfWeek === 1 ? 0 : 8 - dayOfWeek);
  const firstMonday = new Date(quarterStart);
  firstMonday.setDate(quarterStart.getDate() + daysUntilMonday);

  // Calculate week start (Monday)
  const weekStart = new Date(firstMonday);
  weekStart.setDate(firstMonday.getDate() + (semana - 1) * 7);

  // Week end (Friday)
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 4);

  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${weekStart.getDate()} - ${weekEnd.getDate()} ${months[weekEnd.getMonth()]} ${year}`;
}

// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════

export function OperacionPageClient() {
  const { settings, loading: loadingSettings } = useSettings();
  const trimestre = settings?.trimestre_activo || null;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calendario, setCalendario] = useState<CalendarioGetResponse | null>(null);
  const [resumen, setResumen] = useState<CalendarioResumen | null>(null);
  const [empresas, setEmpresas] = useState<EmpresaSimple[]>([]);
  const [semanaActual, setSemanaActual] = useState<number>(1);
  const [selectedSlots, setSelectedSlots] = useState<Set<number>>(new Set());
  const [updatingSlot, setUpdatingSlot] = useState<number | null>(null);

  // Filters
  const [filtroEstado, setFiltroEstado] = useState<string>("Todos");
  const [filtroPrograma, setFiltroPrograma] = useState<string>("Todos");
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>("");

  // Import Excel
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportarExcelResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const gridRef = useRef<HTMLDivElement>(null);

  // ── Load data ──────────────────────────────────────────────

  const cargarDatos = useCallback(async () => {
    if (!trimestre) return;
    setLoading(true);
    setError(null);
    try {
      const [calResult, resResult, empList] = await Promise.all([
        actionObtenerCalendario(trimestre),
        actionObtenerResumen(trimestre),
        obtenerEmpresas(),
      ]);
      if (!calResult.ok) throw new Error(calResult.error);
      if (!resResult.ok) throw new Error(resResult.error);
      setCalendario(calResult.data);
      setResumen(resResult.data);
      setEmpresas(empList);
      if (calResult.data.slots.length > 0) {
        const weeks = [...new Set(calResult.data.slots.map(s => s.semana))].sort((a, b) => a - b);
        setSemanaActual(weeks[0]);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, [trimestre]);

  useEffect(() => {
    if (trimestre) {
      cargarDatos();
    }
  }, [cargarDatos, trimestre]);

  // ── Computed data ──────────────────────────────────────────

  const semanas = useMemo(() => {
    if (!calendario) return [];
    return [...new Set(calendario.slots.map(s => s.semana))].sort((a, b) => a - b);
  }, [calendario]);

  const weekStats = useMemo(() => {
    if (!calendario) return {};
    const stats: Record<number, { vacantes: number; ok: number; cancelados: number; total: number }> = {};
    for (const slot of calendario.slots) {
      if (!stats[slot.semana]) {
        stats[slot.semana] = { vacantes: 0, ok: 0, cancelados: 0, total: 0 };
      }
      stats[slot.semana].total++;
      if (slot.estado === "VACANTE") stats[slot.semana].vacantes++;
      if (slot.estado === "OK") stats[slot.semana].ok++;
      if (slot.estado === "CANCELADO") stats[slot.semana].cancelados++;
    }
    return stats;
  }, [calendario]);

  const slotsSemanales = useMemo(() => {
    if (!calendario) return [];
    let slots = calendario.slots.filter(s => s.semana === semanaActual);

    // Apply filters
    if (filtroEstado !== "Todos") {
      slots = slots.filter(s => s.estado === filtroEstado);
    }
    if (filtroPrograma !== "Todos") {
      slots = slots.filter(s => s.programa === filtroPrograma);
    }
    if (filtroEmpresa.trim()) {
      const search = filtroEmpresa.toLowerCase();
      slots = slots.filter(s =>
        s.empresa_nombre?.toLowerCase().includes(search) ||
        s.taller_nombre.toLowerCase().includes(search)
      );
    }

    return slots.sort((a, b) => {
      const diaA = DIAS_ORDEN.indexOf(a.dia as typeof DIAS_ORDEN[number]);
      const diaB = DIAS_ORDEN.indexOf(b.dia as typeof DIAS_ORDEN[number]);
      if (diaA !== diaB) return diaA - diaB;
      return a.horario.localeCompare(b.horario);
    });
  }, [calendario, semanaActual, filtroEstado, filtroPrograma, filtroEmpresa]);

  const totalSlotsWeek = useMemo(() => {
    if (!calendario) return 0;
    return calendario.slots.filter(s => s.semana === semanaActual).length;
  }, [calendario, semanaActual]);

  const hasNotesInWeek = useMemo(() => {
    return slotsSemanales.some(s => s.notas);
  }, [slotsSemanales]);

  // ── Actions ────────────────────────────────────────────────

  const handleUpdateSlot = useCallback(async (
    slotId: number,
    updates: { estado?: string; confirmado?: boolean; empresa_id?: number | null; notas?: string | null }
  ) => {
    if (!trimestre) return;
    setUpdatingSlot(slotId);
    try {
      const result = await actionActualizarSlot(trimestre, slotId, updates);
      if (!result.ok) throw new Error(result.error);
      toast.success("Slot actualizado");
      await cargarDatos();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al actualizar slot";
      toast.error(msg);
      setError(msg);
    } finally {
      setUpdatingSlot(null);
    }
  }, [trimestre, cargarDatos]);

  const handleBatchUpdate = useCallback(async (updates: { estado?: string; confirmado?: boolean }) => {
    if (!trimestre || selectedSlots.size === 0) return;
    setLoading(true);
    try {
      const batchUpdates = Array.from(selectedSlots).map(slot_id => ({ slot_id, ...updates }));
      const result = await actionActualizarSlotsBatch(trimestre, batchUpdates);
      if (!result.ok) throw new Error(result.error);
      toast.success(`${result.data.updated} slots actualizados`);
      setSelectedSlots(new Set());
      await cargarDatos();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al actualizar slots";
      toast.error(msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [trimestre, selectedSlots, cargarDatos]);

  const handleExport = useCallback(async () => {
    if (!trimestre) return;
    try {
      const blob = await exportarExcel(trimestre);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `calendario_${trimestre}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Excel exportado");
    } catch (e: unknown) {
      toast.error("Error al exportar");
    }
  }, [trimestre]);

  const handleImportFile = useCallback(async (file: File) => {
    if (!trimestre) return;
    setImporting(true);
    setImportResult(null);
    try {
      // First do a dry run to preview changes
      const result = await actionImportarExcelCalendario(trimestre, file, true);
      if (!result.ok) throw new Error(result.error);
      setImportResult(result.data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al procesar Excel";
      toast.error(msg);
      setShowImportModal(false);
    } finally {
      setImporting(false);
    }
  }, [trimestre]);

  const handleConfirmImport = useCallback(async (file: File) => {
    if (!trimestre) return;
    setImporting(true);
    try {
      const result = await actionImportarExcelCalendario(trimestre, file, false);
      if (!result.ok) throw new Error(result.error);
      toast.success(`${result.data.actualizados} slots actualizados`);
      setShowImportModal(false);
      setImportResult(null);
      await cargarDatos();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al importar";
      toast.error(msg);
    } finally {
      setImporting(false);
    }
  }, [trimestre, cargarDatos]);

  const toggleSlotSelection = (slotId: number) => {
    setSelectedSlots(prev => {
      const next = new Set(prev);
      if (next.has(slotId)) next.delete(slotId);
      else next.add(slotId);
      return next;
    });
  };

  const selectAllVisible = () => {
    const ids = slotsSemanales.map(s => s.id);
    setSelectedSlots(new Set(ids));
  };

  const clearSelection = () => setSelectedSlots(new Set());

  // ── Keyboard shortcuts ─────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "a" && gridRef.current?.contains(document.activeElement)) {
        e.preventDefault();
        selectAllVisible();
      }
      if (e.key === "Escape") {
        clearSelection();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [slotsSemanales]);

  // ══════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Operacion Trimestral</h1>
          <p className="text-sm text-slate-500">Gestiona el calendario en tiempo real</p>
        </div>
        <div className="flex items-center gap-3">
          {loadingSettings ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
              Cargando...
            </div>
          ) : trimestre ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2">
              <span className="text-sm font-semibold text-slate-700">{trimestre}</span>
            </div>
          ) : null}
          <button
            onClick={() => setShowImportModal(true)}
            disabled={!trimestre}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Importar Excel
          </button>
          <button
            onClick={handleExport}
            disabled={!trimestre}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            Exportar Excel
          </button>
        </div>
      </div>

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImportFile(file);
          e.target.value = "";
        }}
      />

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-sm underline">Cerrar</button>
        </div>
      )}

      {/* Loading */}
      {loading && !calendario && (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        </div>
      )}

      {/* Summary Cards - Responsive */}
      {resumen && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <SummaryCard label="Total" value={resumen.total_slots} color="slate" />
          <SummaryCard label="Asignados" value={resumen.asignados} color="blue" />
          <SummaryCard label="Vacantes" value={resumen.vacantes} color="amber" />
          <SummaryCard label="Confirmados" value={resumen.confirmados} color="sky" />
          <SummaryCard label="OK" value={resumen.ok} color="green" />
          <SummaryCard label="Cancelados" value={resumen.cancelados} color="red" />
        </div>
      )}

      {/* Segmented Progress Bar */}
      {resumen && resumen.total_slots > 0 && (
        <div className="rounded-lg bg-white p-4 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">Progreso del trimestre</span>
            <span className="text-sm text-slate-500">{resumen.progress_pct}% completado</span>
          </div>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden flex">
            <div className="bg-green-500 transition-all" style={{ width: `${(resumen.ok / resumen.total_slots) * 100}%` }} />
            <div className="bg-red-400 transition-all" style={{ width: `${(resumen.cancelados / resumen.total_slots) * 100}%` }} />
            <div className="bg-blue-400 transition-all" style={{ width: `${(resumen.confirmados / resumen.total_slots) * 100}%` }} />
            <div className="bg-slate-300 transition-all" style={{ width: `${((resumen.asignados - resumen.confirmados - resumen.ok - resumen.cancelados) / resumen.total_slots) * 100}%` }} />
            <div className="bg-amber-300 transition-all" style={{ width: `${(resumen.vacantes / resumen.total_slots) * 100}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
            <span><span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1" />OK: {resumen.ok} ({Math.round((resumen.ok / resumen.total_slots) * 100)}%)</span>
            <span><span className="inline-block w-2 h-2 rounded-full bg-blue-400 mr-1" />Confirmados: {resumen.confirmados} ({Math.round((resumen.confirmados / resumen.total_slots) * 100)}%)</span>
            <span><span className="inline-block w-2 h-2 rounded-full bg-slate-300 mr-1" />Planificados: {resumen.asignados - resumen.confirmados - resumen.ok - resumen.cancelados}</span>
            <span><span className="inline-block w-2 h-2 rounded-full bg-amber-300 mr-1" />Vacantes: {resumen.vacantes} ({Math.round((resumen.vacantes / resumen.total_slots) * 100)}%)</span>
          </div>
        </div>
      )}

      {/* Week Selector with badges */}
      {calendario && semanas.length > 0 && (
        <div className="rounded-lg bg-white p-4 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-700">Seleccionar semana</span>
            <span className="text-xs text-slate-400">Click en semana para ver slots</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {semanas.map(sem => {
              const stats = weekStats[sem] || { vacantes: 0, ok: 0, cancelados: 0, total: 0 };
              const isActive = semanaActual === sem;
              const isComplete = stats.ok === stats.total && stats.total > 0;
              const hasCancel = stats.cancelados > 0;
              const dateRange = trimestre ? getWeekDateRange(trimestre, sem) : "";

              return (
                <button
                  key={sem}
                  onClick={() => setSemanaActual(sem)}
                  title={`${dateRange}${stats.vacantes > 0 ? ` - ${stats.vacantes} vacantes` : ""}`}
                  className={`relative flex flex-col items-center rounded-lg px-3 py-2 text-xs transition-all border min-w-13 ${
                    isActive
                      ? "border-blue-400 bg-blue-100 shadow-sm ring-2 ring-blue-200"
                      : stats.vacantes > 0
                        ? "border-amber-200 bg-amber-50 hover:bg-amber-100"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  {/* Status indicators */}
                  {isComplete && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-green-500 text-[8px] text-white">✓</span>
                  )}
                  {hasCancel && !isComplete && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-red-400" />
                  )}

                  <span className={`font-bold ${isActive ? "text-blue-700" : stats.vacantes > 0 ? "text-amber-800" : "text-slate-600"}`}>
                    S{sem}
                  </span>

                  {/* Vacancy badge */}
                  {stats.vacantes > 0 && (
                    <span className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white">
                      {stats.vacantes}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters & Bulk Actions Bar */}
      {calendario && (
        <div className="rounded-lg bg-slate-50 p-4 border border-slate-200 space-y-3">
          {/* Filters row */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-slate-600">Filtros:</span>

            <select
              value={filtroEstado}
              onChange={e => setFiltroEstado(e.target.value)}
              className="text-sm rounded-md border border-slate-300 px-2 py-1.5 bg-white focus:ring-2 focus:ring-blue-500"
            >
              {ESTADO_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt === "Todos" ? "Estado" : opt}</option>
              ))}
            </select>

            <select
              value={filtroPrograma}
              onChange={e => setFiltroPrograma(e.target.value)}
              className="text-sm rounded-md border border-slate-300 px-2 py-1.5 bg-white focus:ring-2 focus:ring-blue-500"
            >
              {PROGRAMA_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt === "Todos" ? "Programa" : opt}</option>
              ))}
            </select>

            <Input
              type="text"
              placeholder="Buscar empresa o taller..."
              value={filtroEmpresa}
              onChange={e => setFiltroEmpresa(e.target.value)}
              className="w-52 text-sm h-8"
            />

            {(filtroEstado !== "Todos" || filtroPrograma !== "Todos" || filtroEmpresa) && (
              <button
                onClick={() => { setFiltroEstado("Todos"); setFiltroPrograma("Todos"); setFiltroEmpresa(""); }}
                className="text-xs text-slate-500 hover:text-slate-700 underline"
              >
                Limpiar filtros
              </button>
            )}
          </div>

          {/* Selection & Actions row */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200">
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-600">
                Mostrando <strong>{slotsSemanales.length}</strong> de <strong>{totalSlotsWeek}</strong> slots
              </span>
              <button
                onClick={selectAllVisible}
                className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
              >
                Seleccionar todos
              </button>
              {selectedSlots.size > 0 && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                  {selectedSlots.size} seleccionados
                </Badge>
              )}
            </div>

            {selectedSlots.size > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleBatchUpdate({ confirmado: true, estado: "CONFIRMADO" })}
                  className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Confirmar
                </button>
                <button
                  onClick={() => handleBatchUpdate({ estado: "OK" })}
                  className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                >
                  Marcar OK
                </button>
                <button
                  onClick={() => handleBatchUpdate({ estado: "CANCELADO" })}
                  className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={clearSelection}
                  className="px-3 py-1.5 text-xs font-medium bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300 transition-colors"
                >
                  Limpiar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Slots Grid */}
      {calendario && (
        <div ref={gridRef} className="space-y-4" tabIndex={0}>
          {DIAS_ORDEN.map(dia => {
            const slotsDelDia = slotsSemanales.filter(s => s.dia === dia);
            if (slotsDelDia.length === 0) return null;

            return (
              <div key={dia} className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-700">{DIAS_LABEL[dia]}</h3>
                  <span className="text-xs text-slate-400">{slotsDelDia.length} slots</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {slotsDelDia.map(slot => (
                    <SlotRow
                      key={slot.id}
                      slot={slot}
                      empresas={empresas}
                      isSelected={selectedSlots.has(slot.id)}
                      isUpdating={updatingSlot === slot.id}
                      showNotes={hasNotesInWeek}
                      onToggleSelect={() => toggleSlotSelection(slot.id)}
                      onUpdate={(updates) => handleUpdateSlot(slot.id, updates)}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {slotsSemanales.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              No hay slots que coincidan con los filtros
            </div>
          )}
        </div>
      )}

      {/* Import Excel Modal */}
      {showImportModal && (
        <ImportExcelModal
          trimestre={trimestre || ""}
          importing={importing}
          importResult={importResult}
          fileInputRef={fileInputRef}
          onClose={() => {
            setShowImportModal(false);
            setImportResult(null);
          }}
          onConfirm={handleConfirmImport}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// SUMMARY CARD
// ══════════════════════════════════════════════════════════════

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    slate: "bg-slate-100 text-slate-800 border-slate-200",
    blue: "bg-blue-50 text-blue-800 border-blue-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    sky: "bg-sky-50 text-sky-800 border-sky-200",
    green: "bg-green-50 text-green-800 border-green-200",
    red: "bg-red-50 text-red-800 border-red-200",
  };
  return (
    <div className={`rounded-lg p-3 border ${colors[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs opacity-70">{label}</div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// SLOT ROW
// ══════════════════════════════════════════════════════════════

function SlotRow({
  slot,
  empresas,
  isSelected,
  isUpdating,
  showNotes,
  onToggleSelect,
  onUpdate,
}: {
  slot: SlotCalendario;
  empresas: EmpresaSimple[];
  isSelected: boolean;
  isUpdating: boolean;
  showNotes: boolean;
  onToggleSelect: () => void;
  onUpdate: (updates: { estado?: string; confirmado?: boolean; empresa_id?: number | null; notas?: string | null }) => void;
}) {
  const [showAssign, setShowAssign] = useState(false);
  const [showChangeEmpresa, setShowChangeEmpresa] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [noteText, setNoteText] = useState(slot.notas || "");
  const [empresaSearch, setEmpresaSearch] = useState("");

  const config = ESTADO_CONFIG[slot.estado] || ESTADO_CONFIG.PLANIFICADO;
  const isVacante = slot.estado === "VACANTE";
  const isCancelado = slot.estado === "CANCELADO";

  const filteredEmpresas = useMemo(() => {
    const search = empresaSearch.toLowerCase();
    return empresas
      .filter(e => !search || e.nombre.toLowerCase().includes(search))
      .slice(0, 20);
  }, [empresas, empresaSearch]);

  const handleSaveNote = () => {
    onUpdate({ notas: noteText || null });
    setShowAddNote(false);
  };

  const handleAssignEmpresa = (empresaId: number) => {
    onUpdate({ empresa_id: empresaId });
    setShowAssign(false);
    setShowChangeEmpresa(false);
    setEmpresaSearch("");
  };

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 border-l-4 transition-opacity ${config.bg} ${config.leftBorder} ${
        isUpdating ? "opacity-50 pointer-events-none" : ""
      } ${isCancelado ? "opacity-60" : ""}`}
    >
      {/* Checkbox */}
      <Checkbox
        checked={isSelected}
        onCheckedChange={onToggleSelect}
        disabled={isUpdating}
        className="shrink-0"
      />

      {/* Time */}
      <div className="w-24 shrink-0">
        <div className={`text-sm font-medium ${isCancelado ? "line-through text-slate-400" : "text-slate-800"}`}>
          {slot.horario}
        </div>
      </div>

      {/* Taller */}
      <div className="w-48 shrink-0">
        <div className={`text-sm ${isCancelado ? "line-through text-slate-400" : "text-slate-600"}`}>
          {slot.taller_nombre}
        </div>
      </div>

      {/* Programa Badge */}
      <Badge
        variant="secondary"
        className={`shrink-0 ${slot.programa === "EF" ? "bg-blue-100 text-blue-700" : "bg-violet-100 text-violet-700"}`}
      >
        {slot.programa}
      </Badge>

      {/* Empresa / Vacancy */}
      <div className="flex-1 min-w-0">
        {isVacante ? (
          <div className="flex items-center gap-2">
            <span className="font-semibold text-amber-600">VACANTE</span>
            {showAssign ? (
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  placeholder="Buscar empresa..."
                  value={empresaSearch}
                  onChange={e => setEmpresaSearch(e.target.value)}
                  className="w-40 h-7 text-xs"
                  autoFocus
                />
                <select
                  className="text-xs border rounded px-2 py-1 max-w-50"
                  onChange={(e) => handleAssignEmpresa(parseInt(e.target.value))}
                  defaultValue=""
                >
                  <option value="" disabled>Seleccionar...</option>
                  {filteredEmpresas.map(e => (
                    <option key={e.id} value={e.id}>{e.nombre}</option>
                  ))}
                </select>
                <button onClick={() => { setShowAssign(false); setEmpresaSearch(""); }} className="text-xs text-slate-400 hover:text-slate-600">
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAssign(true)}
                className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded hover:bg-amber-200 transition-colors"
              >
                Asignar empresa
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className={`font-medium truncate ${isCancelado ? "line-through text-slate-400" : config.text}`}>
              {slot.empresa_nombre}
            </span>
            <Badge variant="outline" className={`shrink-0 text-[10px] ${config.border} ${config.text}`}>
              {slot.estado}
            </Badge>
            {slot.notas && (
              <span title={slot.notas} className="cursor-help text-slate-400 hover:text-slate-600">
                📝
              </span>
            )}
          </div>
        )}
      </div>

      {/* Notes column (if any slot has notes) */}
      {showNotes && !isVacante && (
        <div className="w-6 shrink-0 text-center">
          {slot.notas ? (
            <span title={slot.notas} className="cursor-help text-amber-500">📝</span>
          ) : null}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        {slot.estado === "PLANIFICADO" && (
          <>
            <button
              onClick={() => onUpdate({ confirmado: true, estado: "CONFIRMADO" })}
              className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors font-medium"
              disabled={isUpdating}
            >
              Confirmar
            </button>
            <button
              onClick={() => onUpdate({ estado: "CANCELADO" })}
              className="text-xs px-2 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200 transition-colors"
              disabled={isUpdating}
            >
              Cancelar
            </button>
          </>
        )}
        {slot.estado === "CONFIRMADO" && (
          <>
            <button
              onClick={() => onUpdate({ estado: "OK" })}
              className="text-xs px-2.5 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors font-medium"
              disabled={isUpdating}
            >
              OK
            </button>
            <button
              onClick={() => onUpdate({ estado: "CANCELADO" })}
              className="text-xs px-2 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200 transition-colors"
              disabled={isUpdating}
            >
              Cancelar
            </button>
          </>
        )}

        {/* More menu */}
        {!isVacante && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="text-slate-400 hover:text-slate-600 px-1.5 py-1 rounded hover:bg-slate-100 transition-colors">
                ···
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => setShowChangeEmpresa(true)}>
                Cambiar empresa
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowAddNote(true)}>
                {slot.notas ? "Editar nota" : "Añadir nota"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Change empresa modal */}
      {showChangeEmpresa && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowChangeEmpresa(false)}>
          <div className="bg-white rounded-lg p-4 shadow-xl w-80" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-slate-800 mb-3">Cambiar empresa</h3>
            <Input
              type="text"
              placeholder="Buscar empresa..."
              value={empresaSearch}
              onChange={e => setEmpresaSearch(e.target.value)}
              className="mb-2"
              autoFocus
            />
            <div className="max-h-48 overflow-y-auto border rounded">
              {filteredEmpresas.map(e => (
                <button
                  key={e.id}
                  onClick={() => handleAssignEmpresa(e.id)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 transition-colors border-b last:border-b-0"
                >
                  {e.nombre}
                </button>
              ))}
            </div>
            <button
              onClick={() => { setShowChangeEmpresa(false); setEmpresaSearch(""); }}
              className="mt-3 w-full py-2 text-sm text-slate-600 hover:text-slate-800"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Add note modal */}
      {showAddNote && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowAddNote(false)}>
          <div className="bg-white rounded-lg p-4 shadow-xl w-80" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-slate-800 mb-3">{slot.notas ? "Editar nota" : "Añadir nota"}</h3>
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="Escribe una nota..."
              className="w-full border rounded-md p-2 text-sm h-24 resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleSaveNote}
                className="flex-1 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Guardar
              </button>
              <button
                onClick={() => { setShowAddNote(false); setNoteText(slot.notas || ""); }}
                className="flex-1 py-2 text-sm text-slate-600 hover:text-slate-800 border rounded-md hover:bg-slate-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Import Excel Modal Component ─────────────────────────────

function ImportExcelModal({
  trimestre,
  importing,
  importResult,
  fileInputRef,
  onClose,
  onConfirm,
}: {
  trimestre: string;
  importing: boolean;
  importResult: ImportarExcelResult | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onClose: () => void;
  onConfirm: (file: File) => void;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith(".xlsx") || file.name.endsWith(".xls"))) {
      setSelectedFile(file);
    }
  };

  // When file is selected, trigger preview
  useEffect(() => {
    if (selectedFile && !importResult && !importing) {
      // Trigger the parent handler for dry run
      const input = fileInputRef.current;
      if (input) {
        const dt = new DataTransfer();
        dt.items.add(selectedFile);
        input.files = dt.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
  }, [selectedFile, importResult, importing, fileInputRef]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Importar Excel</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Actualiza el calendario importando el excel editado ( usa el mismo formato que el exportado previamente desde el sistema)
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1">
          {!importResult && !importing && (
            <div
              className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-colors cursor-pointer"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => document.getElementById("import-file-input")?.click()}
            >
              <input
                id="import-file-input"
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileSelect}
              />
              <div className="text-4xl mb-3">📥</div>
              <p className="text-sm font-medium text-slate-700 mb-1">
                Arrastra el Excel aqui o haz click para seleccionar
              </p>
              <p className="text-xs text-slate-500">
                Solo archivos .xlsx o .xls exportados desde el sistema
              </p>
            </div>
          )}

          {importing && (
            <div className="flex flex-col items-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent mb-4" />
              <p className="text-sm text-slate-600">Analizando Excel...</p>
            </div>
          )}

          {importResult && (
            <div className="space-y-4">
              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
                  <div className="text-xl font-bold text-slate-800">{importResult.total_procesados}</div>
                  <div className="text-[10px] uppercase text-slate-500">Filas</div>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-center">
                  <div className="text-xl font-bold text-blue-700">{importResult.actualizados || importResult.empresas_cambiadas.length}</div>
                  <div className="text-[10px] uppercase text-blue-600">Cambios</div>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
                  <div className="text-xl font-bold text-amber-700">{importResult.errores}</div>
                  <div className="text-[10px] uppercase text-amber-600">Errores</div>
                </div>
              </div>

              {/* All changes detail (estado, confirmado, empresa) */}
              {importResult.cambios_detalle && importResult.cambios_detalle.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px] text-blue-700">
                      {importResult.cambios_detalle.length}
                    </span>
                    Cambios detectados
                  </h4>
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                    {importResult.cambios_detalle.map((cd, i) => (
                      <div key={i} className="px-3 py-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-slate-700">
                            S{cd.semana} {cd.dia} — {cd.taller_nombre}
                          </span>
                          <Badge variant="outline" className="text-[9px]">
                            {cd.campo}
                          </Badge>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-slate-500">
                          {cd.empresa_nombre && (
                            <span className="text-slate-400 mr-1">{cd.empresa_nombre}:</span>
                          )}
                          <span className="text-red-600 line-through">{cd.valor_anterior}</span>
                          <span>→</span>
                          <span className="text-green-600 font-medium">{cd.valor_nuevo}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Warnings */}
              {importResult.warnings.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-amber-700 mb-2">
                    Advertencias ({importResult.warnings.length})
                  </h4>
                  <div className="max-h-32 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <ul className="text-xs text-amber-800 space-y-1">
                      {importResult.warnings.slice(0, 10).map((w, i) => (
                        <li key={i}>• {w}</li>
                      ))}
                      {importResult.warnings.length > 10 && (
                        <li className="text-amber-600">... y {importResult.warnings.length - 10} más</li>
                      )}
                    </ul>
                  </div>
                </div>
              )}

              {/* No changes message — only show when actualizados is truly 0 */}
              {importResult.actualizados === 0 && importResult.errores === 0 && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center">
                  <div className="text-2xl mb-2">✓</div>
                  <p className="text-sm text-slate-600">
                    No hay cambios para aplicar. El calendario ya esta actualizado.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
          >
            Cancelar
          </button>
          {importResult && importResult.actualizados > 0 && selectedFile && (
            <button
              onClick={() => onConfirm(selectedFile)}
              disabled={importing}
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {importing ? "Aplicando..." : `Aplicar ${importResult.actualizados} cambios`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
