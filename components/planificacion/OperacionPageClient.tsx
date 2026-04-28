"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  actionObtenerCalendario,
  actionActualizarSlot,
  actionActualizarSlotsBatch,
  actionObtenerResumen,
  actionImportarExcelCalendario,
  actionImportarExcelCalendarioBulk,
  actionValidarAsignacion,
  actionListarExtras,
  actionBorrarSlotExtra,
} from "@/actions/calendario-actions";
import { useSettings } from "@/hooks/use-settings";
import { usePlanningStatus } from "@/hooks/use-planning-status";
import { exportarExcel, obtenerEmpresas, obtenerTalleres } from "@/lib/api";
import { CrearExtraModal } from "./extras/CrearExtraModal";
import type { TallerOut } from "@/types/taller";
import type {
  SlotCalendario,
  CalendarioGetResponse,
  CalendarioResumen,
  CambioDetalle,
  ImportarExcelResult,
  ImportarExcelBulkResult,
  EstadoSlot,
  ListaExtrasResponse,
  SlotExtraResponse,
} from "@/types/calendario";
import type { EmpresaSimple } from "@/types/empresa";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

// ── Constants ────────────────────────────────────────────────

const DIAS_ORDEN = ["L", "M", "X", "J", "V"] as const;
const DIAS_LABEL: Record<string, string> = {
  L: "Lunes", M: "Martes", X: "Miercoles", J: "Jueves", V: "Viernes",
};

// V17: dropped OK option. CONFIRMADO is the terminal state.
const ESTADO_OPTIONS = ["Todos", "VACANTE", "PLANIFICADO", "CONFIRMADO", "CANCELADO"] as const;
const PROGRAMA_OPTIONS = ["Todos", "EF", "IT"] as const;
// V20: CONTINGENCIA exists in the schema but is rare and not part of day-to-day
// planner filtering — deliberately excluded. "Solo BASE" / "Solo EXTRA" are exact.
const TIPO_ASIGNACION_OPTIONS = ["Todos", "BASE", "EXTRA"] as const;

// V17: CONFIRMADO inherits the former OK green palette (terminal state).
const ESTADO_CONFIG: Record<string, { bg: string; border: string; text: string; leftBorder: string }> = {
  VACANTE:     { bg: "bg-amber-50",   border: "border-amber-200", text: "text-amber-700",  leftBorder: "border-l-amber-400" },
  PLANIFICADO: { bg: "bg-white",      border: "border-slate-200", text: "text-slate-700",  leftBorder: "border-l-slate-300" },
  CONFIRMADO:  { bg: "bg-green-50",   border: "border-green-200", text: "text-green-700",  leftBorder: "border-l-green-500" },
  CANCELADO:   { bg: "bg-red-50/50",  border: "border-red-200",   text: "text-red-600",    leftBorder: "border-l-red-400" },
};

// V17: localStorage key for the operation page's quarter selection.
// Schema additions are out of scope this release, so the per-page UI
// preference lives client-side rather than on appSettings.
const TRIMESTRE_STORAGE_KEY = "operacion.trimestreSeleccionado";

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
  const { status: planningStatus } = usePlanningStatus();

  // V17: quarter selector. Defaults to trimestre_siguiente when present,
  // falls back to trimestre_activo. Persisted via localStorage so the
  // planner returns to the last viewed quarter on reload.
  const trimestreActivo = settings?.trimestre_activo ?? null;
  const trimestreSiguiente = settings?.trimestre_siguiente ?? null;
  const defaultTrimestre = trimestreSiguiente ?? trimestreActivo;

  const [trimestre, setTrimestre] = useState<string | null>(null);

  // Once settings load, hydrate the selector from localStorage (if it points
  // to a still-valid quarter) or fall back to the default.
  useEffect(() => {
    if (loadingSettings) return;
    if (trimestre !== null) return;  // already initialised
    if (defaultTrimestre === null && trimestreActivo === null && trimestreSiguiente === null) return;
    let initial: string | null = defaultTrimestre;
    try {
      const stored = typeof window !== "undefined" ? window.localStorage.getItem(TRIMESTRE_STORAGE_KEY) : null;
      if (stored && (stored === trimestreActivo || stored === trimestreSiguiente)) {
        initial = stored;
      }
    } catch {
      // localStorage unavailable — fall back to default silently.
    }
    setTrimestre(initial);
  }, [loadingSettings, defaultTrimestre, trimestreActivo, trimestreSiguiente, trimestre]);

  const trimestreOptions = useMemo(() => {
    const opts: { value: string; label: string; sublabel: string }[] = [];
    if (trimestreSiguiente) {
      opts.push({ value: trimestreSiguiente, label: trimestreSiguiente, sublabel: "siguiente" });
    }
    if (trimestreActivo) {
      opts.push({ value: trimestreActivo, label: trimestreActivo, sublabel: "activo" });
    }
    return opts;
  }, [trimestreActivo, trimestreSiguiente]);

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
  const [filtroTipo, setFiltroTipo] = useState<string>("Todos");
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>("");

  // Import Excel — legacy UPDATE flow (preview + apply via /importar-excel-file)
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportarExcelResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Import Excel — V19 bulk INSERT flow (always wipes trimestre first)
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkImportResult, setBulkImportResult] = useState<ImportarExcelBulkResult | null>(null);

  // V20: EXTRAS panel state (collapsible list of escuela-propia extra slots).
  const [extrasData, setExtrasData] = useState<ListaExtrasResponse | null>(null);
  const [extrasLoading, setExtrasLoading] = useState<boolean>(false);
  const [extrasPanelExpanded, setExtrasPanelExpanded] = useState<boolean>(false);
  const [deletingExtraId, setDeletingExtraId] = useState<number | null>(null);
  const [confirmDeleteExtra, setConfirmDeleteExtra] = useState<SlotExtraResponse | null>(null);

  // V21 / F3b: Crear EXTRA modal — talleres are loaded once for the catalog
  // Select; the modal handles its own empresas-EP fetch (cached per session).
  const [showCrearExtraModal, setShowCrearExtraModal] = useState<boolean>(false);
  const [talleres, setTalleres] = useState<TallerOut[]>([]);

  // Unified assignment modal state
  // Handles all assignment scenarios: warnings, motivo selection, or both
  const [assignModal, setAssignModal] = useState<{
    type: "warning_only" | "motivo_only" | "warning_with_motivo";
    slotId: number;
    empresaId: number;
    empresaNombre: string;
    warnings: string[];
    restriccionesVioladas: string[];
  } | null>(null);

  // Selected motivo in modal (for reassignments)
  const [selectedMotivo, setSelectedMotivo] = useState<"EMPRESA_CANCELO" | "DECISION_PLANIFICADOR" | null>(null);

  // Cancel-specific modal (separate from assignment)
  const [cancelModal, setCancelModal] = useState<{
    slotId: number;
  } | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);

  // ── Load data ──────────────────────────────────────────────

  const cargarDatos = useCallback(async (preserveWeek: boolean = false) => {
    if (!trimestre) return;
    setLoading(true);
    setError(null);
    try {
      const [calResult, resResult, empList, tallerList] = await Promise.all([
        actionObtenerCalendario(trimestre),
        actionObtenerResumen(trimestre),
        obtenerEmpresas(),
        obtenerTalleres(undefined, true), // V21 / F3b: catalog feeds CrearExtraModal Select
      ]);
      if (!calResult.ok) throw new Error(calResult.error);
      if (!resResult.ok) throw new Error(resResult.error);
      setCalendario(calResult.data);
      setResumen(resResult.data);
      setEmpresas(empList);
      setTalleres(tallerList);

      // Only set week on initial load or if current week is invalid
      if (calResult.data.slots.length > 0) {
        const weeks = [...new Set(calResult.data.slots.map(s => s.semana))].sort((a, b) => a - b);
        if (!preserveWeek) {
          // Initial load — set to first week
          setSemanaActual(weeks[0]);
        } else {
          // Refresh after update — only reset if current week doesn't exist
          setSemanaActual(prev => weeks.includes(prev) ? prev : weeks[0]);
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, [trimestre]);

  // V20: load EXTRAS for the active trimestre. Silent failure — the panel is
  // supplementary; a hiccup here must not block the main calendar.
  const cargarExtras = useCallback(async () => {
    if (!trimestre) return;
    setExtrasLoading(true);
    try {
      const result = await actionListarExtras(trimestre);
      if (!result.ok) throw new Error(result.error);
      setExtrasData(result.data);
    } catch (e: unknown) {
      console.error("Error cargando EXTRAS:", e);
      setExtrasData(null);
    } finally {
      setExtrasLoading(false);
    }
  }, [trimestre]);

  useEffect(() => {
    if (trimestre) {
      cargarDatos();
      cargarExtras();
    }
  }, [cargarDatos, cargarExtras, trimestre]);

  // V20: delete an EXTRA slot. Refreshes both the main grid (the row vanishes
  // from there too) and the EXTRAS panel. Modal stays open on error so the
  // planner can retry; toast surfaces the backend's detail message.
  const handleDeleteExtra = useCallback(async (slot: SlotExtraResponse) => {
    setDeletingExtraId(slot.id);
    try {
      const result = await actionBorrarSlotExtra(slot.id);
      if (!result.ok) throw new Error(result.error);
      toast.success(
        `EXTRA borrado: S${slot.semana} ${slot.dia} ${slot.horario} — ${slot.empresa_nombre ?? "(sin empresa)"}`
      );
      setConfirmDeleteExtra(null);
      await cargarDatos(true);
      await cargarExtras();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al borrar EXTRA";
      toast.error(msg);
    } finally {
      setDeletingExtraId(null);
    }
  }, [cargarDatos, cargarExtras]);

  // V17: switch trimestre. Persists selection, resets week/filters/selection
  // before re-fetching for the new trimestre.
  const handleTrimestreChange = useCallback((next: string) => {
    if (next === trimestre) return;
    setSemanaActual(1);
    setSelectedSlots(new Set());
    setFiltroEstado("Todos");
    setFiltroPrograma("Todos");
    setFiltroTipo("Todos");
    setFiltroEmpresa("");
    setCalendario(null);
    setResumen(null);
    setExtrasData(null);
    setExtrasPanelExpanded(false);
    setTrimestre(next);
    try {
      window.localStorage.setItem(TRIMESTRE_STORAGE_KEY, next);
    } catch {
      // ignore storage failures
    }
  }, [trimestre]);

  // ── Computed data ──────────────────────────────────────────

  const semanas = useMemo(() => {
    if (!calendario) return [];
    return [...new Set(calendario.slots.map(s => s.semana))].sort((a, b) => a - b);
  }, [calendario]);

  const weekStats = useMemo(() => {
    if (!calendario) return {};
    // V17: track confirmados (terminal state) instead of ok.
    const stats: Record<number, { vacantes: number; confirmados: number; cancelados: number; total: number }> = {};
    for (const slot of calendario.slots) {
      if (!stats[slot.semana]) {
        stats[slot.semana] = { vacantes: 0, confirmados: 0, cancelados: 0, total: 0 };
      }
      stats[slot.semana].total++;
      if (slot.estado === "VACANTE") stats[slot.semana].vacantes++;
      if (slot.estado === "CONFIRMADO") stats[slot.semana].confirmados++;
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
    if (filtroTipo !== "Todos") {
      slots = slots.filter(s => s.tipo_asignacion === filtroTipo);
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
  }, [calendario, semanaActual, filtroEstado, filtroPrograma, filtroTipo, filtroEmpresa]);

  const totalSlotsWeek = useMemo(() => {
    if (!calendario) return 0;
    return calendario.slots.filter(s => s.semana === semanaActual).length;
  }, [calendario, semanaActual]);

  const hasNotesInWeek = useMemo(() => {
    return slotsSemanales.some(s => s.notas);
  }, [slotsSemanales]);

  // V20: group EXTRAS by semana for the collapsible panel.
  const extrasPorSemana = useMemo(() => {
    if (!extrasData) return [] as { semana: number; items: SlotExtraResponse[] }[];
    const groups = new Map<number, SlotExtraResponse[]>();
    for (const ex of extrasData.extras) {
      if (!groups.has(ex.semana)) groups.set(ex.semana, []);
      groups.get(ex.semana)!.push(ex);
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => a - b)
      .map(([semana, items]) => ({ semana, items }));
  }, [extrasData]);

  // ── Actions ────────────────────────────────────────────────

  const handleUpdateSlot = useCallback(async (
    slotId: number,
    updates: { estado?: EstadoSlot; confirmado?: boolean; empresa_id?: number | null; notas?: string | null; motivo_cambio?: string | null }
  ) => {
    if (!trimestre) return;
    setUpdatingSlot(slotId);
    try {
      const result = await actionActualizarSlot(trimestre, slotId, updates);
      if (!result.ok) throw new Error(result.error);
      toast.success("Slot actualizado");
      await cargarDatos(true);  // Preserve selected week
      await cargarExtras();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al actualizar slot";
      toast.error(msg);
      setError(msg);
    } finally {
      setUpdatingSlot(null);
    }
  }, [trimestre, cargarDatos, cargarExtras]);

  // Validate assignment before assigning a company
  const handleValidateAndAssign = useCallback(async (
    slotId: number,
    empresaId: number,
    empresaNombre: string,
    currentEmpresaId: number | null,
  ) => {
    if (!trimestre) return;

    const isReassignment = currentEmpresaId !== null;

    // ALWAYS validate first (for both vacant slots and reassignments)
    try {
      const result = await actionValidarAsignacion(trimestre, slotId, empresaId);
      if (!result.ok) throw new Error(result.error);

      const hasViolations = result.data.warnings.length > 0;

      if (hasViolations && isReassignment) {
        // Reassignment with violations → unified modal (warnings + motivo selector)
        setSelectedMotivo(null);
        setAssignModal({
          type: "warning_with_motivo",
          slotId,
          empresaId,
          empresaNombre,
          warnings: result.data.warnings,
          restriccionesVioladas: result.data.restricciones_violadas,
        });
      } else if (hasViolations && !isReassignment) {
        // Vacant slot with violations → warning-only modal (no motivo needed)
        setAssignModal({
          type: "warning_only",
          slotId,
          empresaId,
          empresaNombre,
          warnings: result.data.warnings,
          restriccionesVioladas: result.data.restricciones_violadas,
        });
      } else if (!hasViolations && isReassignment) {
        // Reassignment without violations → motivo-only modal
        setSelectedMotivo(null);
        setAssignModal({
          type: "motivo_only",
          slotId,
          empresaId,
          empresaNombre,
          warnings: [],
          restriccionesVioladas: [],
        });
      } else {
        // Vacant slot without violations → assign directly
        await handleUpdateSlot(slotId, { empresa_id: empresaId });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al validar";
      toast.error(msg);
    }
  }, [trimestre, handleUpdateSlot]);

  // Confirm assignment from unified modal
  const handleConfirmAssignment = useCallback(async () => {
    if (!assignModal) return;

    // Determine the motivo_cambio to send
    let motivo: string | undefined;
    if (assignModal.type === "warning_only") {
      // Vacant slot with violations → always DECISION_PLANIFICADOR
      motivo = "DECISION_PLANIFICADOR";
    } else if (assignModal.type === "motivo_only" || assignModal.type === "warning_with_motivo") {
      // Reassignment → use selected motivo
      if (!selectedMotivo) return; // Button should be disabled, but safety check
      motivo = selectedMotivo;
    }

    await handleUpdateSlot(assignModal.slotId, {
      empresa_id: assignModal.empresaId,
      motivo_cambio: motivo,
    });
    setAssignModal(null);
    setSelectedMotivo(null);
  }, [assignModal, selectedMotivo, handleUpdateSlot]);

  // Handle cancel slot action (separate from reassignment)
  const handleRequestCancel = useCallback((slotId: number) => {
    setCancelModal({ slotId });
  }, []);

  // Confirm cancel with motivo
  const handleConfirmCancel = useCallback(async (motivo: "EMPRESA_CANCELO" | "DECISION_PLANIFICADOR") => {
    if (!cancelModal) return;
    await handleUpdateSlot(cancelModal.slotId, { estado: "CANCELADO", motivo_cambio: motivo });
    setCancelModal(null);
  }, [cancelModal, handleUpdateSlot]);

  const handleBatchUpdate = useCallback(async (updates: { estado?: EstadoSlot; confirmado?: boolean }) => {
    if (!trimestre || selectedSlots.size === 0) return;
    setLoading(true);
    try {
      const batchUpdates = Array.from(selectedSlots).map(slot_id => ({ slot_id, ...updates }));
      const result = await actionActualizarSlotsBatch(trimestre, batchUpdates);
      if (!result.ok) throw new Error(result.error);
      toast.success(`${result.data.updated} slots actualizados`);
      setSelectedSlots(new Set());
      await cargarDatos(true);  // Preserve selected week
      await cargarExtras();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al actualizar slots";
      toast.error(msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [trimestre, selectedSlots, cargarDatos, cargarExtras]);

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
      await cargarDatos(true);  // Preserve selected week
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al importar";
      toast.error(msg);
    } finally {
      setImporting(false);
    }
  }, [trimestre, cargarDatos]);

  // V19 bulk INSERT path. Always wipeFirst=true here — the modal forces it.
  const handleBulkImport = useCallback(async (file: File) => {
    if (!trimestre) return;
    setBulkImporting(true);
    setBulkImportResult(null);
    try {
      const result = await actionImportarExcelCalendarioBulk(trimestre, file, true);
      if (!result.ok) throw new Error(result.error);
      const { insertados, vacantes, errores } = result.data;
      const errSuffix = errores ? `, ${errores} errores` : "";
      toast.success(`${insertados} insertados, ${vacantes} vacantes${errSuffix}`);
      setBulkImportResult(result.data);
      setShowBulkImportModal(false);
      await cargarDatos(true);
      await cargarExtras();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al cargar calendario";
      toast.error(msg);
      // Leave modal open on error so user can retry / cancel.
    } finally {
      setBulkImporting(false);
    }
  }, [trimestre, cargarDatos, cargarExtras]);

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
          ) : trimestreOptions.length > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-600">Trimestre:</span>
              <Select
                value={trimestre ?? undefined}
                onValueChange={handleTrimestreChange}
              >
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Selecciona…" />
                </SelectTrigger>
                <SelectContent>
                  {trimestreOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className="flex items-baseline gap-2">
                        <span className="font-semibold">{opt.label}</span>
                        <span className="text-xs text-slate-500">{opt.sublabel}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
              No hay trimestres configurados
            </div>
          )}
          <button
            onClick={() => setShowBulkImportModal(true)}
            disabled={!trimestre}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
            title="Carga inicial del trimestre — borra todo y reinserta desde el Excel."
          >
            📦 Cargar calendario completo
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            disabled={!trimestre}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
            title="Ajustes durante el trimestre — actualiza empresa, estado o confirmación de slots existentes."
          >
            ✏️ Actualizar slots
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

      {/* Empty State: Calendar not generated yet */}
      {!loading && calendario && calendario.total_slots === 0 && trimestre && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
            <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-amber-900">
            El calendario de {trimestre} aun no ha sido generado
          </h3>
          <p className="mt-2 text-sm text-amber-700">
            {planningStatus?.activo_tiene_frecuencias
              ? "El trimestre tiene frecuencias confirmadas. Solo falta generar el calendario en Fase 2."
              : "Completa la Fase 1 (Frecuencias) y Fase 2 (Calendario) primero."}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            {!planningStatus?.activo_tiene_frecuencias && (
              <a
                href="/planificacion/frecuencias"
                className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 transition-colors"
              >
                Ir a Fase 1 - Frecuencias
              </a>
            )}
            {planningStatus?.activo_tiene_frecuencias && !planningStatus?.activo_tiene_calendario && (
              <a
                href="/planificacion/calendario"
                className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 transition-colors"
              >
                Ir a Fase 2 - Calendario
              </a>
            )}
          </div>
        </div>
      )}

      {/* Summary Cards - Responsive (V17: 5 cards, dropped "OK") */}
      {resumen && resumen.total_slots > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <SummaryCard label="Total" value={resumen.total_slots} color="slate" />
          <SummaryCard label="Asignados" value={resumen.asignados} color="blue" />
          <SummaryCard label="Vacantes" value={resumen.vacantes} color="amber" />
          <SummaryCard label="Confirmados" value={resumen.confirmados} color="green" />
          <SummaryCard label="Cancelados" value={resumen.cancelados} color="red" />
        </div>
      )}

      {/* V20 panel + V21/F3b "Añadir EXTRA" button. Header always renders when
          extrasData has loaded so the planner can create the first EXTRA on a
          fresh trimestre (total=0); chevron only shown when total>0 since
          there's nothing to expand otherwise. */}
      {extrasData && (
        <div className="rounded-lg border border-amber-200 bg-amber-50">
          <div className="w-full flex items-center gap-2 px-4 py-3 hover:bg-amber-100/60 transition-colors rounded-lg">
            <button
              type="button"
              onClick={() => setExtrasPanelExpanded(prev => !prev)}
              disabled={extrasData.total === 0}
              className="flex items-center gap-3 flex-1 text-left disabled:cursor-default"
              aria-expanded={extrasData.total > 0 ? extrasPanelExpanded : undefined}
            >
              <span className="text-lg">⚠️</span>
              <div>
                <div className="text-sm font-semibold text-amber-900">
                  {extrasData.total} slot{extrasData.total === 1 ? "" : "s"} EXTRA{" "}
                  {extrasData.total === 0 ? "en este trimestre" : `detectado${extrasData.total === 1 ? "" : "s"}`}
                </div>
                <div className="text-xs text-amber-700">
                  Asignaciones extra de empresas con escuela propia. Revisar y borrar las que no correspondan.
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setShowCrearExtraModal(true)}
              disabled={!trimestre}
              className="shrink-0 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Crear un slot EXTRA puntual"
            >
              + Añadir EXTRA
            </button>
            {extrasData.total > 0 && (
              <button
                type="button"
                onClick={() => setExtrasPanelExpanded(prev => !prev)}
                className="shrink-0 p-1 rounded hover:bg-amber-100"
                aria-label={extrasPanelExpanded ? "Colapsar panel EXTRA" : "Expandir panel EXTRA"}
              >
                <svg
                  className={`h-5 w-5 text-amber-700 transition-transform ${extrasPanelExpanded ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}
          </div>

          {extrasPanelExpanded && extrasData.total > 0 && (
            <div className="border-t border-amber-200 px-4 py-3 space-y-3 max-h-96 overflow-y-auto">
              {extrasPorSemana.map(({ semana, items }) => (
                <div key={semana}>
                  <div className="text-xs font-semibold text-amber-900 mb-1.5">
                    Semana {semana} <span className="text-amber-600 font-normal">({items.length})</span>
                  </div>
                  <div className="space-y-1">
                    {items.map(ex => (
                      <div
                        key={ex.id}
                        className="flex items-center gap-3 rounded-md bg-white border border-amber-200 px-3 py-2 text-xs"
                      >
                        <span className="font-mono text-slate-500 w-12 shrink-0">{ex.dia} {ex.horario}</span>
                        <span className="text-slate-700 truncate flex-1">{ex.taller_nombre}</span>
                        <span className="font-medium text-slate-800 truncate flex-1">{ex.empresa_nombre ?? "—"}</span>
                        <Badge variant="outline" className="shrink-0 text-[10px]">{ex.estado}</Badge>
                        <button
                          onClick={() => setConfirmDeleteExtra(ex)}
                          disabled={deletingExtraId === ex.id}
                          className="shrink-0 text-xs px-2 py-1 rounded text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Borrar este slot EXTRA"
                        >
                          {deletingExtraId === ex.id ? "Borrando..." : "Borrar"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Segmented Progress Bar (V17: confirmados / total) */}
      {resumen && resumen.total_slots > 0 && (() => {
        const planificados = Math.max(
          0,
          resumen.asignados - resumen.confirmados - resumen.cancelados,
        );
        const pctCompletado = resumen.total_slots > 0
          ? (resumen.confirmados / resumen.total_slots) * 100
          : 0;
        return (
          <div className="rounded-lg bg-white p-4 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">Progreso del trimestre</span>
              <span className="text-sm text-slate-500">{pctCompletado.toFixed(1)}% completado</span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden flex">
              <div className="bg-green-500 transition-all" style={{ width: `${(resumen.confirmados / resumen.total_slots) * 100}%` }} />
              <div className="bg-red-400 transition-all" style={{ width: `${(resumen.cancelados / resumen.total_slots) * 100}%` }} />
              <div className="bg-blue-400 transition-all" style={{ width: `${(planificados / resumen.total_slots) * 100}%` }} />
              <div className="bg-amber-300 transition-all" style={{ width: `${(resumen.vacantes / resumen.total_slots) * 100}%` }} />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
              <span><span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1" />Confirmados: {resumen.confirmados} ({Math.round((resumen.confirmados / resumen.total_slots) * 100)}%)</span>
              <span><span className="inline-block w-2 h-2 rounded-full bg-blue-400 mr-1" />Planificados: {planificados}</span>
              <span><span className="inline-block w-2 h-2 rounded-full bg-amber-300 mr-1" />Vacantes: {resumen.vacantes} ({Math.round((resumen.vacantes / resumen.total_slots) * 100)}%)</span>
              {resumen.cancelados > 0 && (
                <span><span className="inline-block w-2 h-2 rounded-full bg-red-400 mr-1" />Cancelados: {resumen.cancelados} ({Math.round((resumen.cancelados / resumen.total_slots) * 100)}%)</span>
              )}
            </div>
          </div>
        );
      })()}

      {/* Week Selector with badges */}
      {calendario && semanas.length > 0 && (
        <div className="rounded-lg bg-white p-4 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-700">Seleccionar semana</span>
            <span className="text-xs text-slate-400">Click en semana para ver slots</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {semanas.map(sem => {
              const stats = weekStats[sem] || { vacantes: 0, confirmados: 0, cancelados: 0, total: 0 };
              const isActive = semanaActual === sem;
              const isComplete = stats.confirmados === stats.total && stats.total > 0;
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

            <select
              value={filtroTipo}
              onChange={e => setFiltroTipo(e.target.value)}
              className="text-sm rounded-md border border-slate-300 px-2 py-1.5 bg-white focus:ring-2 focus:ring-blue-500"
            >
              {TIPO_ASIGNACION_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt === "Todos" ? "Tipo" : opt}</option>
              ))}
            </select>

            <Input
              type="text"
              placeholder="Buscar empresa o taller..."
              value={filtroEmpresa}
              onChange={e => setFiltroEmpresa(e.target.value)}
              className="w-52 text-sm h-8"
            />

            {(filtroEstado !== "Todos" || filtroPrograma !== "Todos" || filtroTipo !== "Todos" || filtroEmpresa) && (
              <button
                onClick={() => { setFiltroEstado("Todos"); setFiltroPrograma("Todos"); setFiltroTipo("Todos"); setFiltroEmpresa(""); }}
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
                {/* V17: Confirmar is the terminal action. "Marcar OK" was removed. */}
                <button
                  onClick={() => handleBatchUpdate({ confirmado: true, estado: "CONFIRMADO" })}
                  className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                >
                  Confirmar
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
                      onValidateAndAssign={(empresaId, empresaNombre) =>
                        handleValidateAndAssign(slot.id, empresaId, empresaNombre, slot.empresa_id)
                      }
                      onRequestCancel={() => handleRequestCancel(slot.id)}
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

      {/* Import Excel Modals — mounted only while open so internal state
          (selectedFile, confirmText) resets cleanly between opens. */}
      {showImportModal && (
        <ImportExcelModal
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

      {showBulkImportModal && (
        <BulkImportModal
          trimestre={trimestre || ""}
          importing={bulkImporting}
          onClose={() => setShowBulkImportModal(false)}
          onConfirm={handleBulkImport}
        />
      )}

      {/* Bulk import result panel (visible after a bulk load finishes) */}
      {bulkImportResult && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 flex items-start justify-between">
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-blue-800 mb-1">
              {bulkImportResult.insertados + bulkImportResult.vacantes > 0
                ? `${bulkImportResult.insertados + bulkImportResult.vacantes} slots insertados`
                : "Sin inserciones"}
            </h4>
            <p className="text-xs text-blue-600">
              {bulkImportResult.total_procesados} filas procesadas
              {bulkImportResult.insertados > 0 && `, ${bulkImportResult.insertados} planificados`}
              {bulkImportResult.vacantes > 0 && `, ${bulkImportResult.vacantes} vacantes`}
              {bulkImportResult.empresa_no_encontrada > 0 && `, ${bulkImportResult.empresa_no_encontrada} empresa(s) no encontrada(s)`}
              {bulkImportResult.taller_no_encontrado > 0 && `, ${bulkImportResult.taller_no_encontrado} taller(es) no encontrado(s)`}
              {bulkImportResult.errores > 0 && `, ${bulkImportResult.errores} errores`}
              {bulkImportResult.wipe_first && " · trimestre previamente vaciado"}
            </p>
            {bulkImportResult.warnings.length > 0 && (
              <details className="mt-2">
                <summary className="text-xs text-amber-700 cursor-pointer">
                  Ver {bulkImportResult.warnings.length} advertencia(s) / error(es) por fila
                </summary>
                <ul className="mt-1 text-xs text-amber-700 pl-4 list-disc max-h-48 overflow-y-auto">
                  {bulkImportResult.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </details>
            )}
          </div>
          <button onClick={() => setBulkImportResult(null)} className="text-blue-400 hover:text-blue-600 ml-2">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Unified Assignment Modal - handles warnings and/or motivo selection */}
      {assignModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            {/* Header */}
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              {assignModal.type === "motivo_only"
                ? "¿Por qué se cambia la empresa?"
                : "Confirmar asignación"}
            </h3>

            {/* Description */}
            <p className="text-sm text-slate-600 mb-4">
              {assignModal.type === "motivo_only" ? (
                <>Cambiar a <strong>{assignModal.empresaNombre}</strong>. Selecciona el motivo del cambio.</>
              ) : (
                <>Asignar <strong>{assignModal.empresaNombre}</strong> a este slot.</>
              )}
            </p>

            {/* Warnings Section (shown for warning_only and warning_with_motivo) */}
            {(assignModal.type === "warning_only" || assignModal.type === "warning_with_motivo") && (
              <div className="space-y-3 mb-4">
                {/* Hard constraints (red) */}
                {assignModal.restriccionesVioladas.length > 0 && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                    <h4 className="text-sm font-semibold text-red-800 mb-2">Restricciones duras</h4>
                    <ul className="space-y-1.5">
                      {assignModal.restriccionesVioladas.map((w, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                          <span className="shrink-0">🔴</span>
                          <span>{w}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {/* Soft constraints (yellow) */}
                {assignModal.warnings.filter(w => !assignModal.restriccionesVioladas.includes(w)).length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <h4 className="text-sm font-semibold text-amber-800 mb-2">Preferencias no cumplidas</h4>
                    <ul className="space-y-1.5">
                      {assignModal.warnings
                        .filter(w => !assignModal.restriccionesVioladas.includes(w))
                        .map((w, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-amber-700">
                            <span className="shrink-0">🟡</span>
                            <span>{w}</span>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Motivo Selector (shown for motivo_only and warning_with_motivo) */}
            {(assignModal.type === "motivo_only" || assignModal.type === "warning_with_motivo") && (
              <div className="mb-6">
                {assignModal.type === "warning_with_motivo" && (
                  <p className="text-sm text-slate-600 mb-3">Selecciona el motivo del cambio:</p>
                )}
                <div className="space-y-2">
                  <button
                    onClick={() => setSelectedMotivo("EMPRESA_CANCELO")}
                    className={`w-full flex items-center gap-3 p-3 border-2 rounded-lg transition-colors text-left ${
                      selectedMotivo === "EMPRESA_CANCELO"
                        ? "border-red-400 bg-red-50"
                        : "border-slate-200 hover:border-red-300 hover:bg-red-50"
                    }`}
                  >
                    <span className="text-xl">🏢</span>
                    <div>
                      <div className="font-medium text-slate-900">La empresa canceló</div>
                      <div className="text-xs text-slate-500">Afecta la fiabilidad de la empresa original</div>
                    </div>
                  </button>
                  <button
                    onClick={() => setSelectedMotivo("DECISION_PLANIFICADOR")}
                    className={`w-full flex items-center gap-3 p-3 border-2 rounded-lg transition-colors text-left ${
                      selectedMotivo === "DECISION_PLANIFICADOR"
                        ? "border-blue-400 bg-blue-50"
                        : "border-slate-200 hover:border-blue-300 hover:bg-blue-50"
                    }`}
                  >
                    <span className="text-xl">📋</span>
                    <div>
                      <div className="font-medium text-slate-900">Decisión del planificador</div>
                      <div className="text-xs text-slate-500">No afecta la fiabilidad de la empresa original</div>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setAssignModal(null); setSelectedMotivo(null); }}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmAssignment}
                disabled={
                  (assignModal.type === "motivo_only" || assignModal.type === "warning_with_motivo") &&
                  !selectedMotivo
                }
                className={`px-4 py-2 text-sm text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  assignModal.warnings.length > 0
                    ? assignModal.restriccionesVioladas.length > 0
                      ? "bg-red-500 hover:bg-red-600"
                      : "bg-amber-500 hover:bg-amber-600"
                    : "bg-blue-500 hover:bg-blue-600"
                }`}
              >
                {assignModal.warnings.length > 0 ? "Asignar de todos modos" : "Confirmar cambio"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Slot Modal (separate from reassignment) */}
      {cancelModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              ¿Por qué se cancela?
            </h3>
            <p className="text-sm text-slate-600 mb-6">
              Selecciona el motivo para mantener un registro correcto de los cambios.
            </p>
            <div className="space-y-3 mb-6">
              <button
                onClick={() => handleConfirmCancel("EMPRESA_CANCELO")}
                className="w-full flex items-center gap-3 p-4 border-2 border-slate-200 rounded-lg hover:border-red-300 hover:bg-red-50 transition-colors text-left"
              >
                <span className="text-2xl">🏢</span>
                <div>
                  <div className="font-medium text-slate-900">La empresa canceló</div>
                  <div className="text-xs text-slate-500">Afecta la fiabilidad de la empresa</div>
                </div>
              </button>
              <button
                onClick={() => handleConfirmCancel("DECISION_PLANIFICADOR")}
                className="w-full flex items-center gap-3 p-4 border-2 border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
              >
                <span className="text-2xl">📋</span>
                <div>
                  <div className="font-medium text-slate-900">Decisión del planificador</div>
                  <div className="text-xs text-slate-500">No afecta la fiabilidad de la empresa</div>
                </div>
              </button>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setCancelModal(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* V20: confirm-delete EXTRA modal */}
      {confirmDeleteExtra && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              ¿Borrar este slot EXTRA?
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              Esta acción es permanente. El slot desaparecerá del calendario y no se puede deshacer.
            </p>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 mb-5">
              <div className="text-xs font-semibold text-amber-900 mb-1">
                Slot a borrar
              </div>
              <div className="text-sm text-slate-800 space-y-0.5">
                <div>
                  <span className="font-mono text-slate-500">
                    S{confirmDeleteExtra.semana} {confirmDeleteExtra.dia} {confirmDeleteExtra.horario}
                  </span>
                </div>
                <div className="text-slate-700">{confirmDeleteExtra.taller_nombre}</div>
                <div className="font-medium">
                  {confirmDeleteExtra.empresa_nombre ?? "(sin empresa)"}
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDeleteExtra(null)}
                disabled={deletingExtraId !== null}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteExtra(confirmDeleteExtra)}
                disabled={deletingExtraId !== null}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deletingExtraId === confirmDeleteExtra.id ? "Borrando..." : "Borrar EXTRA"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* V21 / F3b: create-EXTRA modal. onSuccess refreshes both the main grid
          (where the new slot needs to appear) and the EXTRAS panel — same
          double-refresh shape as handleDeleteExtra. */}
      {trimestre && (
        <CrearExtraModal
          trimestre={trimestre}
          open={showCrearExtraModal}
          onOpenChange={setShowCrearExtraModal}
          onSuccess={() => {
            void cargarDatos(true);
            void cargarExtras();
          }}
          talleres={talleres}
          slotsExistentes={
            calendario
              ? calendario.slots.map(s => ({
                  semana: s.semana,
                  dia: s.dia,
                  horario: s.horario,
                  empresa_id: s.empresa_id,
                  empresa_nombre: s.empresa_nombre,
                }))
              : []
          }
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
  onValidateAndAssign,
  onRequestCancel,
}: {
  slot: SlotCalendario;
  empresas: EmpresaSimple[];
  isSelected: boolean;
  isUpdating: boolean;
  showNotes: boolean;
  onToggleSelect: () => void;
  onUpdate: (updates: { estado?: EstadoSlot; confirmado?: boolean; empresa_id?: number | null; notas?: string | null }) => void;
  onValidateAndAssign: (empresaId: number, empresaNombre: string) => void;
  onRequestCancel: () => void;
}) {
  const [showAssign, setShowAssign] = useState(false);
  const [showChangeEmpresa, setShowChangeEmpresa] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [noteText, setNoteText] = useState(slot.notas || "");
  const [empresaSearch, setEmpresaSearch] = useState("");

  const config = ESTADO_CONFIG[slot.estado] || ESTADO_CONFIG.PLANIFICADO;
  const isVacante = slot.estado === "VACANTE";
  const isCancelado = slot.estado === "CANCELADO";

  // Check if company was changed from original
  const wasCompanyChanged = slot.empresa_id !== slot.empresa_id_original && slot.empresa_id_original !== null;

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
    const empresa = empresas.find(e => e.id === empresaId);
    const empresaNombre = empresa?.nombre || "";
    onValidateAndAssign(empresaId, empresaNombre);
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

      {/* V20: EXTRA badge — escuela-propia ad-hoc slot */}
      {slot.tipo_asignacion === "EXTRA" && (
        <Badge
          variant="outline"
          className="shrink-0 text-[10px] bg-amber-50 text-amber-700 border-amber-300"
        >
          EXTRA
        </Badge>
      )}

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
            {/* Motivo cambio badge */}
            {slot.motivo_cambio === "EMPRESA_CANCELO" && (
              <Badge variant="outline" className="shrink-0 text-[10px] bg-red-50 text-red-600 border-red-200">
                Empresa canceló
              </Badge>
            )}
            {slot.motivo_cambio === "DECISION_PLANIFICADOR" && (
              <Badge variant="outline" className="shrink-0 text-[10px] bg-blue-50 text-blue-600 border-blue-200">
                Cambio planificador
              </Badge>
            )}
            {wasCompanyChanged && !slot.motivo_cambio && (
              <Badge variant="outline" className="shrink-0 text-[10px] bg-slate-50 text-slate-500 border-slate-200">
                Cambiada
              </Badge>
            )}
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
              className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors font-medium"
              disabled={isUpdating}
            >
              Confirmar
            </button>
            <button
              onClick={onRequestCancel}
              className="text-xs px-2 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200 transition-colors"
              disabled={isUpdating}
            >
              Cancelar
            </button>
          </>
        )}
        {/* V17: CONFIRMADO is the terminal state. Only "Cancelar" remains as
            the off-ramp; the former "Marcar OK" transition was removed. */}
        {slot.estado === "CONFIRMADO" && (
          <button
            onClick={onRequestCancel}
            className="text-xs px-2 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200 transition-colors"
            disabled={isUpdating}
          >
            Cancelar
          </button>
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

// ── Import Excel Modal Component (legacy UPDATE flow) ────────
//
// Uses /importar-excel-file: dry-runs first to preview row-level diffs
// (empresa / estado / confirmado), then applies on confirm.
//
// V21 / Deuda 4: shared-slot disambiguation now happens server-side via
// "Empresa Original" (col G) primary match + fallback to col F. The previous
// "Limitación conocida" callout was removed when that landed.

function ImportExcelModal({
  importing,
  importResult,
  fileInputRef,
  onClose,
  onConfirm,
}: {
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

  // Manually trigger the dry-run via the hidden file input that the parent
  // owns. Click handler on "Previsualizar cambios" calls this.
  const triggerDryRun = useCallback(() => {
    if (!selectedFile) return;
    const input = fileInputRef.current;
    if (!input) return;
    const dt = new DataTransfer();
    dt.items.add(selectedFile);
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, [selectedFile, fileInputRef]);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Actualizar slots desde Excel</DialogTitle>
          <DialogDescription>
            Sube un Excel para actualizar empresa, estado o confirmación de slots existentes. Útil para ajustes durante el trimestre.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 -mx-1 px-1">
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
                <CambiosDetallePanel cambios={importResult.cambios_detalle} />
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

        <DialogFooter>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          {!importResult ? (
            <button
              type="button"
              disabled={!selectedFile || importing}
              onClick={triggerDryRun}
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? "Analizando..." : "Previsualizar cambios"}
            </button>
          ) : (
            <button
              onClick={() => selectedFile && onConfirm(selectedFile)}
              disabled={importing || !selectedFile || importResult.actualizados === 0}
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing
                ? "Aplicando..."
                : importResult.actualizados > 0
                  ? `Aplicar ${importResult.actualizados} cambios`
                  : "Aplicar cambios"}
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Bulk INSERT modal (V19) ──────────────────────────────────
//
// Uses /importar-excel-bulk with wipe_first=true (the checkbox is shown
// disabled-and-checked as a visual reminder, not a real toggle). Requires
// the planner to type the trimestre code as confirmation before "Cargar"
// becomes enabled.

function BulkImportModal({
  trimestre,
  importing,
  onClose,
  onConfirm,
}: {
  trimestre: string;
  importing: boolean;
  onClose: () => void;
  onConfirm: (file: File) => void;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [confirmText, setConfirmText] = useState("");

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith(".xlsx") || file.name.endsWith(".xls"))) {
      setSelectedFile(file);
    }
  };

  const handleAttemptedClose = useCallback(() => {
    if (selectedFile && !importing) {
      // Confirm discard before closing if user already picked a file.
      if (!window.confirm("¿Descartar la carga?")) return;
    }
    onClose();
  }, [selectedFile, importing, onClose]);

  const canSubmit =
    !!selectedFile &&
    !importing &&
    !!trimestre &&
    confirmText.trim() === trimestre;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) handleAttemptedClose(); }}>
      <DialogContent
        className="sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col"
        onEscapeKeyDown={(e) => {
          if (selectedFile && !importing) {
            // Let our confirm prompt handle it instead of closing immediately.
            e.preventDefault();
            handleAttemptedClose();
          }
        }}
        onPointerDownOutside={(e) => {
          if (selectedFile && !importing) {
            e.preventDefault();
            handleAttemptedClose();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Cargar calendario completo</DialogTitle>
          <DialogDescription>
            Sube un Excel con el calendario completo del trimestre. Se borrarán todos los slots actuales antes de insertar los nuevos.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 -mx-1 px-1 space-y-4">
          {/* File picker */}
          <div
            className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-colors cursor-pointer"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => document.getElementById("bulk-import-file-input")?.click()}
          >
            <input
              id="bulk-import-file-input"
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileSelect}
            />
            <div className="text-3xl mb-2">📦</div>
            {selectedFile ? (
              <>
                <p className="text-sm font-medium text-slate-800">{selectedFile.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">Click para cambiar el archivo</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-slate-700 mb-1">
                  Arrastra el Excel aquí o haz click para seleccionar
                </p>
                <p className="text-xs text-slate-500">Solo archivos .xlsx o .xls</p>
              </>
            )}
          </div>

          {/* Wipe-first checkbox: visual reinforcement, always checked + disabled */}
          <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 cursor-not-allowed">
            <Checkbox checked disabled className="mt-0.5" />
            <div className="text-xs">
              <div className="font-medium text-slate-700">Borrar trimestre antes de cargar</div>
              <div className="text-slate-500 mt-0.5">
                Se borrarán todos los slots actuales de <span className="font-mono font-semibold">{trimestre || "—"}</span>
              </div>
            </div>
          </label>

          {/* Trimestre confirmation text input */}
          <div>
            <label htmlFor="bulk-confirm-trimestre" className="block text-xs font-medium text-slate-600 mb-1">
              Para confirmar, escribe el código del trimestre (<span className="font-mono">{trimestre || "—"}</span>)
            </label>
            <Input
              id="bulk-confirm-trimestre"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={trimestre || ""}
              autoComplete="off"
              spellCheck={false}
              disabled={importing || !trimestre}
            />
          </div>
        </div>

        <DialogFooter>
          <button
            onClick={handleAttemptedClose}
            disabled={importing}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => selectedFile && onConfirm(selectedFile)}
            disabled={!canSubmit}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importing ? "Cargando..." : "Cargar"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Preview panel for legacy update modal ────────────────────
//
// Shows the first 20 cambios_detalle by default with a "Ver más" affordance.

const CAMBIOS_INICIALES = 20;

function CambiosDetallePanel({ cambios }: { cambios: CambioDetalle[] }) {
  const [expanded, setExpanded] = useState(false);
  const visibles = expanded ? cambios : cambios.slice(0, CAMBIOS_INICIALES);
  const restantes = cambios.length - visibles.length;

  return (
    <div>
      <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-100 px-1 text-[10px] text-blue-700">
          {cambios.length}
        </span>
        Cambios detectados
      </h4>
      <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
        {visibles.map((cd, i) => (
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
      {restantes > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-1 text-xs text-blue-600 hover:text-blue-800 underline underline-offset-2"
        >
          Ver más ({restantes} cambios restantes)
        </button>
      )}
    </div>
  );
}
