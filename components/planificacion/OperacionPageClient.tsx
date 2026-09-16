"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import {
  actionObtenerCalendario,
  actionActualizarSlot,
  actionActualizarSlotsBatch,
  actionObtenerResumen,
  actionImportarExcelCalendarioBulk,
  actionValidarAsignacion,
  actionListarExtras,
  actionBorrarSlotExtra,
  actionListarDobles,
  actionListarFestivos,
} from "@/actions/calendario-actions";
import { useSettings } from "@/hooks/use-settings";
import { usePlanningStatus } from "@/hooks/use-planning-status";
import { exportarExcel, obtenerEmpresasFull, obtenerTalleres } from "@/lib/api";
import { getWeekDateRange, getDayDateLabel, semanaRelativaAISO } from "@/lib/fecha-trimestre";
import { CrearExtraModal } from "./extras/CrearExtraModal";
import { CalendarioMensualView } from "./CalendarioMensualView";
import { AssignmentModal } from "./AssignmentModal";
import { EditarSlotModal } from "./EditarSlotModal";
import { useSlotEditModal } from "@/hooks/use-slot-edit-modal";
import { CrearSlotModal } from "./CrearSlotModal";
import { useCrearSlotModal } from "@/hooks/use-crear-slot-modal";
import type { TallerOut } from "@/types/taller";
import type {
  SlotCalendario,
  CalendarioGetResponse,
  CalendarioResumen,
  Festivo,
  ImportarExcelBulkResult,
  EstadoSlot,
  ListaExtrasResponse,
  SlotExtraResponse,
  ListaDoblesResponse,
  SlotDobleResponse,
} from "@/types/calendario";
import type { EmpresaFull } from "@/types/empresa";
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

// V26: persistencia per-reload de la vista seleccionada (semanal | mensual).
const VISTA_STORAGE_KEY = "operacion.vista";
type VistaOperacion = "semanal" | "mensual";

// V26: tiempo (ms) que dura el highlight visual del slot cuando la
// planificadora vuelve desde la vista mensual a la lista.
const SLOT_HIGHLIGHT_MS = 2500;

// V26: helpers de fecha extraídos a lib/fecha-trimestre.ts para que la vista
// calendario mensual los reutilice sin duplicar la lógica del primer lunes.

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
  const [empresas, setEmpresas] = useState<EmpresaFull[]>([]);
  const [semanaActual, setSemanaActual] = useState<number>(1);
  const [selectedSlots, setSelectedSlots] = useState<Set<number>>(new Set());
  const [updatingSlot, setUpdatingSlot] = useState<number | null>(null);

  // Filters
  const [filtroEstado, setFiltroEstado] = useState<string>("Todos");
  const [filtroPrograma, setFiltroPrograma] = useState<string>("Todos");
  const [filtroTipo, setFiltroTipo] = useState<string>("Todos");
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>("");

  // V26: toggle vista (semanal | mensual) + datos extra para la vista mensual.
  // Persistimos en localStorage para alinear con el patrón existente de
  // trimestre seleccionado (no usamos query params).
  const [vista, setVista] = useState<VistaOperacion>("semanal");
  const [festivos, setFestivos] = useState<Festivo[]>([]);
  // Slot resaltado cuando se navega desde la vista mensual a la lista
  // semanal (highlight transitorio de SLOT_HIGHLIGHT_MS).
  const [slotResaltadoId, setSlotResaltadoId] = useState<number | null>(null);

  // Hidratar vista de localStorage al montar.
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const stored = window.localStorage.getItem(VISTA_STORAGE_KEY);
      if (stored === "semanal" || stored === "mensual") {
        setVista(stored);
      }
    } catch {
      // localStorage no disponible — quedamos en default.
    }
  }, []);

  // Persistir cambios de vista.
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(VISTA_STORAGE_KEY, vista);
    } catch {
      // ignore
    }
  }, [vista]);

  // Limpiar highlight tras SLOT_HIGHLIGHT_MS.
  useEffect(() => {
    if (slotResaltadoId === null) return;
    const id = window.setTimeout(
      () => setSlotResaltadoId(null),
      SLOT_HIGHLIGHT_MS,
    );
    return () => window.clearTimeout(id);
  }, [slotResaltadoId]);


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

  // V22 (Cambio A, Fase 6b): DOBLE read-only data. Drives the "D" badge in the
  // semana selector and the collapsible "Doble de esta semana" section at the
  // bottom of the calendar grid. Edits/creation happen in /planificacion/doble.
  const [doblesData, setDoblesData] = useState<ListaDoblesResponse | null>(null);
  const [doblesSemanaExpanded, setDoblesSemanaExpanded] = useState<boolean>(false);

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
      const [calResult, resResult, empList, tallerList, festResult] =
        await Promise.all([
          actionObtenerCalendario(trimestre),
          actionObtenerResumen(trimestre),
          obtenerEmpresasFull({ activa: true }),
          obtenerTalleres(undefined, true), // V21 / F3b: catalog feeds CrearExtraModal Select
          actionListarFestivos(trimestre),
        ]);
      if (!calResult.ok) throw new Error(calResult.error);
      if (!resResult.ok) throw new Error(resResult.error);
      setCalendario(calResult.data);
      setResumen(resResult.data);
      setEmpresas(empList);
      setTalleres(tallerList);
      // V26: festivos son supplementarios; si fallan dejamos vacío y
      // la vista mensual simplemente no marca celdas.
      setFestivos(festResult.ok ? festResult.data.festivos : []);

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

  // V22 (Cambio A, Fase 6b): load DOBLEs for the active trimestre. Silent
  // failure mirrors the EXTRAS panel — the calendar grid renders regardless.
  const cargarDobles = useCallback(async () => {
    if (!trimestre) return;
    try {
      const result = await actionListarDobles(trimestre);
      if (!result.ok) throw new Error(result.error);
      setDoblesData(result.data);
    } catch (e: unknown) {
      console.error("Error cargando DOBLEs:", e);
      setDoblesData(null);
    }
  }, [trimestre]);

  useEffect(() => {
    if (trimestre) {
      cargarDatos();
      cargarExtras();
      cargarDobles();
    }
  }, [cargarDatos, cargarExtras, cargarDobles, trimestre]);

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
    setDoblesData(null);
    setDoblesSemanaExpanded(false);
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

  // V26: para la vista mensual, los filtros de Estado/Programa/Tipo
  // dejan los slots filtrados en gris (opacos) pero no los esconden —
  // mantiene el layout estable. La búsqueda por empresa/taller resalta
  // los matches con borde naranja, no filtra.
  const slotsVisiblesMensual = useMemo<Set<number> | null>(() => {
    if (!calendario) return null;
    const hayFiltroDuro =
      filtroEstado !== "Todos" ||
      filtroPrograma !== "Todos" ||
      filtroTipo !== "Todos";
    if (!hayFiltroDuro) return null;
    const visibles = new Set<number>();
    for (const s of calendario.slots) {
      if (filtroEstado !== "Todos" && s.estado !== filtroEstado) continue;
      if (filtroPrograma !== "Todos" && s.programa !== filtroPrograma) continue;
      if (filtroTipo !== "Todos" && s.tipo_asignacion !== filtroTipo) continue;
      visibles.add(s.id);
    }
    return visibles;
  }, [calendario, filtroEstado, filtroPrograma, filtroTipo]);

  const slotsHighlightedMensual = useMemo<Set<number>>(() => {
    if (!calendario || !filtroEmpresa.trim()) return new Set();
    const search = filtroEmpresa.toLowerCase();
    const matches = new Set<number>();
    for (const s of calendario.slots) {
      if (
        s.empresa_nombre?.toLowerCase().includes(search) ||
        s.taller_nombre.toLowerCase().includes(search)
      ) {
        matches.add(s.id);
      }
    }
    return matches;
  }, [calendario, filtroEmpresa]);

  // V26: handler legacy — usado mientras la mensual era read-only. Cambia a
  // vista semanal con el slot resaltado. Hoy el click en mini-card abre el
  // EditarSlotModal directamente; este callback queda disponible por si otro
  // contexto necesita la navegación "ir a lista".
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const irASlotEnLista = useCallback((slot: SlotCalendario) => {
    setVista("semanal");
    setSemanaActual(slot.semana);
    setSlotResaltadoId(slot.id);
  }, []);

  // V26 (Paso 3): refresh de calendario + extras tras editar/eliminar desde
  // el EditarSlotModal. Preservamos la semana actual para que la vista lista
  // no salte al S1 cada vez. En vista mensual no afecta — el mes navegado
  // se mantiene en state del propio CalendarioMensualView.
  const refrescarTrasEdicion = useCallback(async () => {
    await cargarDatos(true);
    await cargarExtras();
  }, [cargarDatos, cargarExtras]);

  const { openEditModal, modalProps: editSlotModalProps } = useSlotEditModal({
    onRefresh: refrescarTrasEdicion,
  });

  const { openCrearModal, modalProps: crearSlotModalProps } = useCrearSlotModal({
    onRefresh: refrescarTrasEdicion,
  });

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

  // V22 (Cambio A, Fase 6b): counts of DOBLE rows per semana, used to render
  // the small "D" badge on the week selector buttons.
  const doblesCountPorSemana = useMemo(() => {
    const counts = new Map<number, number>();
    if (!doblesData) return counts;
    for (const d of doblesData.dobles) {
      counts.set(d.semana, (counts.get(d.semana) ?? 0) + 1);
    }
    return counts;
  }, [doblesData]);

  // DOBLE rows for the currently selected week, sorted (día, horario, empresa).
  const doblesEstaSemana = useMemo(() => {
    if (!doblesData) return [] as SlotDobleResponse[];
    return doblesData.dobles
      .filter(d => d.semana === semanaActual)
      .sort((a, b) => {
        const diaA = DIAS_ORDEN.indexOf(a.dia as typeof DIAS_ORDEN[number]);
        const diaB = DIAS_ORDEN.indexOf(b.dia as typeof DIAS_ORDEN[number]);
        if (diaA !== diaB) return diaA - diaB;
        if (a.horario !== b.horario) return a.horario.localeCompare(b.horario);
        return (a.empresa_nombre ?? "").localeCompare(b.empresa_nombre ?? "");
      });
  }, [doblesData, semanaActual]);

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

  // V32: validación previa (dry-run) — no escribe nada. wipe_first=true evita el
  // 409 por filas existentes; dry_run=true hace que el backend NO borre ni inserte.
  const handleBulkPreview = useCallback(async (file: File): Promise<ImportarExcelBulkResult> => {
    if (!trimestre) throw new Error("Sin trimestre");
    const result = await actionImportarExcelCalendarioBulk(trimestre, file, true, true);
    if (!result.ok) throw new Error(result.error);
    return result.data;
  }, [trimestre]);

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
          {/* Always-visible entry point to the CrearExtraModal. When the trimestre has 0
              EXTRAs the amber panel is hidden, so this button is the only way to
              create the first one. When EXTRAs exist there is also a button inside
              the panel (kept for proximity to the list). */}
          <button
            onClick={() => setShowCrearExtraModal(true)}
            disabled={!trimestre}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
            title="Crear un slot EXTRA puntual"
          >
            + Añadir EXTRA
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

      {/* V20 amber EXTRA panel. Only renders when the trimestre has at least
          one EXTRA — the planner's entry point to create the first EXTRA on a
          fresh trimestre is the "+ Añadir EXTRA" button in the page header. */}
      {extrasData && extrasData.total > 0 && (
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
                  Slots EXTRA: talleres adicionales a la frecuencia regular de la empresa.
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
                    Semana {semana}
                    {trimestre && <span className="text-amber-600 font-normal"> · ISO {semanaRelativaAISO(trimestre, semana)}</span>}
                    <span className="text-amber-600 font-normal"> ({items.length})</span>
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
              const dobleCount = doblesCountPorSemana.get(sem) ?? 0;
              const dateRange = trimestre ? getWeekDateRange(trimestre, sem) : "";
              const iso = trimestre ? semanaRelativaAISO(trimestre, sem) : null;
              const titleParts = [iso ? `ISO ${iso}` : "", dateRange];
              if (stats.vacantes > 0) titleParts.push(`${stats.vacantes} vacantes`);
              if (dobleCount > 0) titleParts.push(`${dobleCount} DOBLE`);
              const title = titleParts.filter(Boolean).join(" — ");

              return (
                <button
                  key={sem}
                  onClick={() => setSemanaActual(sem)}
                  title={title}
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
                  {/* V22 (Cambio A, Fase 6b): yellow "D" badge when this week
                      has at least one DOBLE. Positioned at top-left so it
                      never collides with the ✓ / red dot top-right. */}
                  {dobleCount > 0 && (
                    <span
                      className="absolute -top-1 -left-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-yellow-400 px-1 text-[8px] font-bold text-yellow-900 ring-1 ring-yellow-600"
                      title={`${dobleCount} taller${dobleCount === 1 ? "" : "es"} DOBLE en esta semana`}
                    >
                      D{dobleCount > 1 ? `·${dobleCount}` : ""}
                    </span>
                  )}

                  <span className={`font-bold ${isActive ? "text-blue-700" : stats.vacantes > 0 ? "text-amber-800" : "text-slate-600"}`}>
                    S{sem}
                  </span>
                  {/* V35: nº ISO debajo (misma que "Semana EP" del Excel). Solo display. */}
                  {iso !== null && (
                    <span className="text-[9px] leading-none text-slate-400">ISO {iso}</span>
                  )}

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

      {/* V26: toggle vista semanal ↔ mensual */}
      {calendario && (
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-slate-600">Vista:</span>
          <div className="inline-flex rounded-md border border-slate-300 bg-white p-0.5">
            <button
              type="button"
              onClick={() => setVista("semanal")}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                vista === "semanal"
                  ? "bg-blue-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Lista por semana
            </button>
            <button
              type="button"
              onClick={() => setVista("mensual")}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                vista === "mensual"
                  ? "bg-blue-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Calendario mensual
            </button>
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

      {/* Slots Grid — vista lista por semana (default V25 y anteriores) */}
      {calendario && vista === "semanal" && (
        <div ref={gridRef} className="space-y-4" tabIndex={0}>
          {DIAS_ORDEN.map(dia => {
            const slotsDelDia = slotsSemanales.filter(s => s.dia === dia);
            if (slotsDelDia.length === 0) return null;

            return (
              <div key={dia} className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-700">
                    {DIAS_LABEL[dia]}
                    {trimestre && (
                      <span className="ml-2 text-slate-400 font-normal">
                        {getDayDateLabel(trimestre, semanaActual, dia)}
                      </span>
                    )}
                  </h3>
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
                      highlight={slot.id === slotResaltadoId}
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

      {/* V26 (Paso 3): vista calendario mensual. Click en mini-card abre el
          EditarSlotModal — el `irASlotEnLista` original queda disponible para
          otros contextos pero ya no se cablea acá. */}
      {calendario && vista === "mensual" && trimestre && (
        <div className="rounded-lg bg-white p-4 border border-slate-200">
          <CalendarioMensualView
            trimestre={trimestre}
            slots={calendario.slots}
            festivos={festivos}
            slotsVisibles={slotsVisiblesMensual}
            slotsHighlighted={slotsHighlightedMensual}
            semanaActual={semanaActual}
            onSemanaChange={setSemanaActual}
            onClickSlot={openEditModal}
            onCreateClick={openCrearModal}
          />
        </div>
      )}

      {/* V22 (Cambio A, Fase 6b): collapsible DOBLE-de-esta-semana section.
          Read-only here — edits and creation live in /planificacion/doble. */}
      {calendario && doblesEstaSemana.length > 0 && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50">
          <div className="w-full flex items-center gap-2 px-4 py-3 hover:bg-yellow-100/60 transition-colors rounded-lg">
            <button
              type="button"
              onClick={() => setDoblesSemanaExpanded(prev => !prev)}
              className="flex items-center gap-3 flex-1 text-left"
              aria-expanded={doblesSemanaExpanded}
            >
              <span className="text-lg">📒</span>
              <div>
                <div className="text-sm font-semibold text-yellow-900">
                  Doble ({doblesEstaSemana.length} taller{doblesEstaSemana.length === 1 ? "" : "es"})
                </div>
                <div className="text-xs text-yellow-800">
                  Semana intensiva ad-hoc de empresas con escuela propia. Lectura aquí; edición en gestión Doble.
                </div>
              </div>
            </button>
            <Link
              href="/planificacion/doble"
              className="shrink-0 rounded-md border border-yellow-400 bg-white px-3 py-1.5 text-xs font-medium text-yellow-900 hover:bg-yellow-100 transition-colors"
              title="Ir a la página de gestión de DOBLE"
            >
              Editar en gestión Doble →
            </Link>
            <button
              type="button"
              onClick={() => setDoblesSemanaExpanded(prev => !prev)}
              className="shrink-0 p-1 rounded hover:bg-yellow-100"
              aria-label={doblesSemanaExpanded ? "Colapsar sección DOBLE" : "Expandir sección DOBLE"}
            >
              <svg
                className={`h-5 w-5 text-yellow-700 transition-transform ${doblesSemanaExpanded ? "rotate-180" : ""}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {doblesSemanaExpanded && (
            <div className="border-t border-yellow-300 px-4 py-3 max-h-96 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-yellow-900 border-b border-yellow-300">
                    <th className="py-1.5 pr-3 font-medium">Día</th>
                    <th className="py-1.5 pr-3 font-medium">Horario</th>
                    <th className="py-1.5 pr-3 font-medium">Taller</th>
                    <th className="py-1.5 pr-3 font-medium">Programa</th>
                    <th className="py-1.5 pr-3 font-medium">Empresa</th>
                    <th className="py-1.5 pr-3 font-medium">Estado</th>
                    <th className="py-1.5 font-medium">Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {doblesEstaSemana.map(d => (
                    <tr key={d.id} className="border-b border-yellow-200 last:border-b-0">
                      <td className="py-1.5 pr-3 font-mono text-slate-700">{d.dia}</td>
                      <td className="py-1.5 pr-3 font-mono text-slate-700">{d.horario}</td>
                      <td className="py-1.5 pr-3 text-slate-800">{d.taller_nombre}</td>
                      <td className="py-1.5 pr-3">
                        <Badge variant="outline" className="text-[10px]">{d.programa}</Badge>
                      </td>
                      <td className="py-1.5 pr-3 text-slate-800">{d.empresa_nombre ?? "—"}</td>
                      <td className="py-1.5 pr-3">
                        <Badge variant="outline" className="text-[10px]">{d.estado}</Badge>
                      </td>
                      <td className="py-1.5 text-slate-600">{d.notas ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal mounted only while open, para que su estado interno
          (selectedFile, confirmText, preview) se resetee entre aperturas. */}
      {showBulkImportModal && (
        <BulkImportModal
          trimestre={trimestre || ""}
          importing={bulkImporting}
          resumen={resumen}
          onClose={() => setShowBulkImportModal(false)}
          onPreview={handleBulkPreview}
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
            {/* Empresas inexistentes — aviso ROJO accionable. El importador nunca
                crea empresas: la analista debe crearlas en su CRUD y re-subir. */}
            {(bulkImportResult.empresas_no_encontradas?.length ?? 0) > 0 && (
              <div className="mt-2 rounded-md border border-red-300 bg-red-50 p-3">
                <p className="text-xs font-semibold text-red-800">
                  Estas empresas no existen en la base de datos ({bulkImportResult.empresas_no_encontradas!.length}):
                </p>
                <p className="mt-1 text-xs font-medium text-red-700">
                  {bulkImportResult.empresas_no_encontradas!.join(", ")}
                </p>
                <p className="mt-1.5 text-xs text-red-600">
                  Creá cada empresa en <span className="font-semibold">Empresas</span> y volvé a subir el archivo.
                  Las filas con estas empresas fueron rechazadas.
                </p>
              </div>
            )}
            {(bulkImportResult.talleres_no_encontrados?.length ?? 0) > 0 && (
              <div className="mt-2 rounded-md border border-red-300 bg-red-50 p-3">
                <p className="text-xs font-semibold text-red-800">
                  Estos talleres no existen ({bulkImportResult.talleres_no_encontrados!.length}):
                </p>
                <p className="mt-1 text-xs font-medium text-red-700">
                  {bulkImportResult.talleres_no_encontrados!.join(", ")}
                </p>
                <p className="mt-1.5 text-xs text-red-600">
                  Revisá el nombre en <span className="font-semibold">Talleres</span> (debe coincidir y ser del programa correcto).
                </p>
              </div>
            )}
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
      <AssignmentModal
        isOpen={assignModal !== null}
        type={assignModal?.type ?? "warning_only"}
        empresaNombre={assignModal?.empresaNombre ?? ""}
        warnings={assignModal?.warnings ?? []}
        restriccionesVioladas={assignModal?.restriccionesVioladas ?? []}
        selectedMotivo={selectedMotivo}
        onSelectMotivo={setSelectedMotivo}
        onConfirm={handleConfirmAssignment}
        onCancel={() => {
          setAssignModal(null);
          setSelectedMotivo(null);
        }}
      />

      {/* V26 (Paso 3): modal unificado de edición de slot, disparado desde el
          click en mini-card de la vista mensual. */}
      {trimestre && (
        <EditarSlotModal
          {...editSlotModalProps}
          trimestre={trimestre}
          empresas={empresas}
          talleres={talleres}
        />
      )}

      {/* V26 (Paso 4): modal de creación de slot, disparado desde el botón
          "+ HH:MM" de una franja libre en la vista mensual. */}
      {trimestre && (
        <CrearSlotModal
          {...crearSlotModalProps}
          trimestre={trimestre}
          empresas={empresas}
          talleres={talleres}
        />
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
  highlight = false,
  onToggleSelect,
  onUpdate,
  onValidateAndAssign,
  onRequestCancel,
}: {
  slot: SlotCalendario;
  empresas: EmpresaFull[];
  isSelected: boolean;
  isUpdating: boolean;
  showNotes: boolean;
  /** V26: highlight transitorio cuando la planificadora navegó desde la
   *  vista mensual a este slot. Borde naranja + ring para identificarlo. */
  highlight?: boolean;
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
      className={`flex items-center gap-3 px-4 py-3 border-l-4 transition-all ${config.bg} ${config.leftBorder} ${
        isUpdating ? "opacity-50 pointer-events-none" : ""
      } ${isCancelado ? "opacity-60" : ""} ${
        highlight ? "ring-2 ring-orange-400 ring-offset-1" : ""
      }`}
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
            {/* Companion badge surfacing WHICH empresa canceled. Only shown for
                EMPRESA_CANCELO (decision badge for DECISION_PLANIFICADOR doesn't
                imply a real cancellation) and only when the slot was actually
                reassigned away from the original — same-empresa edits keep the
                row visually clean. */}
            {slot.motivo_cambio === "EMPRESA_CANCELO" &&
              slot.empresa_nombre_original &&
              slot.empresa_id_original !== slot.empresa_id && (
              <Badge
                variant="outline"
                className="shrink-0 text-[10px] bg-red-50/40 text-red-700 border-red-200"
                title={`Empresa originalmente asignada: ${slot.empresa_nombre_original}`}
              >
                Canceló: {slot.empresa_nombre_original}
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


// ── Bulk INSERT modal (V19) ──────────────────────────────────
//
// Uses /importar-excel-bulk with wipe_first=true (the checkbox is shown
// disabled-and-checked as a visual reminder, not a real toggle). Requires
// the planner to type the trimestre code as confirmation before "Cargar"
// becomes enabled.

function BulkImportModal({
  trimestre,
  importing,
  resumen,
  onClose,
  onPreview,
  onConfirm,
}: {
  trimestre: string;
  importing: boolean;
  resumen: CalendarioResumen | null; // V31 Capa 0a: recuentos de lo que se reemplaza
  onClose: () => void;
  onPreview: (file: File) => Promise<ImportarExcelBulkResult>;
  onConfirm: (file: File) => void;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [confirmText, setConfirmText] = useState("");
  // V32: validación previa (dry-run). No se aplica nada hasta que la revisión
  // salga sin bloqueos (empresas/talleres inexistentes o errores de fila).
  const [preview, setPreview] = useState<ImportarExcelBulkResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const resetPreview = () => {
    setPreview(null);
    setPreviewError(null);
    setConfirmText("");
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setSelectedFile(file); resetPreview(); }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith(".xlsx") || file.name.endsWith(".xls"))) {
      setSelectedFile(file);
      resetPreview();
    }
  };

  const handleRevisar = async () => {
    if (!selectedFile) return;
    setChecking(true);
    setPreviewError(null);
    try {
      const r = await onPreview(selectedFile);
      setPreview(r);
    } catch (e: unknown) {
      setPreviewError(e instanceof Error ? e.message : "Error al revisar el archivo");
    } finally {
      setChecking(false);
    }
  };

  const blockers = preview
    ? (preview.empresas_no_encontradas?.length ?? 0) +
      (preview.talleres_no_encontrados?.length ?? 0) +
      (preview.errores ?? 0)
    : 0;
  const previewClean = !!preview && blockers === 0;

  const handleAttemptedClose = useCallback(() => {
    if (selectedFile && !importing) {
      // Confirm discard before closing if user already picked a file.
      if (!window.confirm("¿Descartar la carga?")) return;
    }
    onClose();
  }, [selectedFile, importing, onClose]);

  const canApply =
    previewClean &&
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
            Subí el Excel del trimestre. Primero <b>Revisar</b> (no escribe nada);
            si la revisión sale sin errores, <b>Aplicar</b> reemplaza todos los slots.
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

          {/* Error al ejecutar la revisión (red de red) */}
          {previewError && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              {previewError}
            </div>
          )}

          {/* ── Resultado de la revisión (dry-run) ── */}
          {preview && (
            <div className="space-y-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                <span className="font-semibold text-slate-800">{preview.total_procesados}</span> filas revisadas ·{" "}
                <span className="font-semibold text-slate-800">{preview.insertados + preview.vacantes}</span> slots se cargarían
                {preview.extras_insertados > 0 && <> · {preview.extras_insertados} extra(s)</>}
              </div>

              {(preview.empresas_no_encontradas?.length ?? 0) > 0 && (
                <div className="rounded-md border border-red-300 bg-red-50 p-3">
                  <p className="text-xs font-semibold text-red-800">
                    Empresas que no existen en la base de datos ({preview.empresas_no_encontradas!.length}):
                  </p>
                  <p className="mt-1 text-xs font-medium text-red-700">
                    {preview.empresas_no_encontradas!.join(", ")}
                  </p>
                  <p className="mt-1.5 text-xs text-red-600">
                    Creá cada empresa en <span className="font-semibold">Empresas</span> y volvé a revisar.
                  </p>
                </div>
              )}

              {(preview.talleres_no_encontrados?.length ?? 0) > 0 && (
                <div className="rounded-md border border-red-300 bg-red-50 p-3">
                  <p className="text-xs font-semibold text-red-800">
                    Talleres que no existen ({preview.talleres_no_encontrados!.length}):
                  </p>
                  <p className="mt-1 text-xs font-medium text-red-700">
                    {preview.talleres_no_encontrados!.join(", ")}
                  </p>
                  <p className="mt-1.5 text-xs text-red-600">
                    Revisá el nombre en <span className="font-semibold">Talleres</span> (debe coincidir y ser del programa correcto).
                  </p>
                </div>
              )}

              {preview.errores > 0 && (
                <div className="rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-700">
                  <span className="font-semibold">{preview.errores}</span> fila(s) con errores. Mirá los avisos de abajo.
                </div>
              )}

              {preview.warnings.length > 0 && (
                <details>
                  <summary className="text-xs text-amber-700 cursor-pointer">
                    Ver {preview.warnings.length} aviso(s) por fila
                  </summary>
                  <ul className="mt-1 text-xs text-amber-700 pl-4 list-disc max-h-40 overflow-y-auto">
                    {preview.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </details>
              )}

              {/* Semáforo del estado de la revisión */}
              {blockers > 0 ? (
                <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-medium text-red-800">
                  Bloqueado: corregí el archivo y volvé a revisarlo. No se aplicará nada hasta que la revisión salga sin errores.
                </div>
              ) : (
                <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
                  Revisión OK, sin errores. Confirmá abajo para aplicar (reemplaza el trimestre).
                </div>
              )}
            </div>
          )}

          {/* Recordatorio de borrado + confirmación — solo si la revisión está limpia */}
          {previewClean && (
            <>
              <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 cursor-not-allowed">
                <Checkbox checked disabled className="mt-0.5" />
                <div className="text-xs">
                  <div className="font-medium text-slate-700">Borrar trimestre antes de cargar</div>
                  <div className="text-slate-500 mt-0.5">
                    Se borrarán todos los slots actuales de <span className="font-mono font-semibold">{trimestre || "—"}</span>
                  </div>
                  {/* V31 Capa 0a: recuentos de lo que se reemplaza */}
                  {resumen && resumen.total_slots > 0 && (
                    <div className="text-slate-600 mt-1">
                      Vas a reemplazar los <span className="font-semibold">{resumen.total_slots}</span> slots de{" "}
                      {trimestre} ({resumen.confirmados} confirmados, {resumen.cancelados} cancelados).
                    </div>
                  )}
                </div>
              </label>

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
            </>
          )}
        </div>

        <DialogFooter>
          <button
            onClick={handleAttemptedClose}
            disabled={importing}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          {previewClean ? (
            <button
              onClick={() => selectedFile && onConfirm(selectedFile)}
              disabled={!canApply}
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? "Aplicando..." : "Aplicar"}
            </button>
          ) : (
            <button
              onClick={handleRevisar}
              disabled={!selectedFile || checking || importing}
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {checking ? "Revisando..." : (preview ? "Revisar de nuevo" : "Revisar")}
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

