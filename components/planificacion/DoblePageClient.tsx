"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { useSettings } from "@/hooks/use-settings";
import { obtenerTalleres } from "@/lib/api";
import {
  actionListarDobles,
  actionCrearDoble,
  actionEditarDoble,
  actionBorrarDoble,
} from "@/actions/calendario-actions";
import { actionListarEmpresasDoble } from "@/actions/config-trimestral-actions";
import type {
  SlotDobleResponse,
  CrearSlotDobleInput,
  EditarSlotDobleInput,
} from "@/types/calendario";
import type { EmpresaDoble } from "@/types/config-trimestral";
import type { TallerOut } from "@/types/taller";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DIAS_OPTIONS: { value: string; label: string }[] = [
  { value: "L", label: "Lunes" },
  { value: "M", label: "Martes" },
  { value: "X", label: "Miércoles" },
  { value: "J", label: "Jueves" },
  { value: "V", label: "Viernes" },
];

const DIAS_ORDEN = ["L", "M", "X", "J", "V"] as const;

const SEMANAS = Array.from({ length: 13 }, (_, i) => i + 1);

// Shape of the modal form. Mirrors EditarSlotDobleInput but with required
// fields when creating — the modal enforces non-null on submit.
interface ModalForm {
  empresa_id: number | null;
  semana: number | null;
  dia: string | null;
  horario: string;
  taller_id: number | null;
  notas: string;
}

const EMPTY_FORM: ModalForm = {
  empresa_id: null,
  semana: null,
  dia: null,
  horario: "",
  taller_id: null,
  notas: "",
};

export function DoblePageClient() {
  const { settings, loading: loadingSettings } = useSettings();

  // ── Selector state ───────────────────────────────────────────
  const [trimestre, setTrimestre] = useState<string | null>(null);
  const [semana, setSemana] = useState<number>(1);

  // Default trimestre to siguiente (preparation quarter) when available, else
  // activo. The DOBLE page is mostly used during prep, before operación.
  useEffect(() => {
    if (settings && !trimestre) {
      setTrimestre(settings.trimestre_siguiente ?? settings.trimestre_activo);
    }
  }, [settings, trimestre]);

  const trimestreOptions = useMemo(() => {
    if (!settings) return [];
    const opts = [
      { value: settings.trimestre_activo, label: `${settings.trimestre_activo} (Activo)` },
    ];
    if (settings.trimestre_siguiente) {
      opts.unshift({
        value: settings.trimestre_siguiente,
        label: `${settings.trimestre_siguiente} (Preparación)`,
      });
    }
    return opts;
  }, [settings]);

  // ── Data state ───────────────────────────────────────────────
  // V25 Cambio C (Capa 4): listado migrado de `/empresas-ep` (CT.escuelaPropia)
  // a `/empresas-doble` (empresa.puedeSerDoble). EP y Doble son ahora
  // ortogonales — el listado de Doble no se mezcla más con el de EP.
  const [empresasDoble, setEmpresasDoble] = useState<EmpresaDoble[]>([]);
  const [empresasDobleError, setEmpresasDobleError] = useState<string | null>(null);
  const [dobles, setDobles] = useState<SlotDobleResponse[]>([]);
  const [doblesLoading, setDoblesLoading] = useState<boolean>(false);
  const [talleres, setTalleres] = useState<TallerOut[]>([]);

  // ── Modal state ──────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [modalSlotId, setModalSlotId] = useState<number | null>(null);
  const [modalForm, setModalForm] = useState<ModalForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Confirm-delete state.
  const [confirmDelete, setConfirmDelete] = useState<SlotDobleResponse | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // ── Data loaders ─────────────────────────────────────────────
  const cargarEmpresasDoble = useCallback(async () => {
    if (!trimestre) return;
    const result = await actionListarEmpresasDoble(trimestre);
    if (result.ok) {
      setEmpresasDoble(result.data.empresas);
      setEmpresasDobleError(null);
    } else {
      setEmpresasDoble([]);
      setEmpresasDobleError(result.error);
    }
  }, [trimestre]);

  const cargarDobles = useCallback(async () => {
    if (!trimestre) return;
    setDoblesLoading(true);
    try {
      const result = await actionListarDobles(trimestre);
      if (!result.ok) throw new Error(result.error);
      setDobles(result.data.dobles);
    } catch (e: unknown) {
      console.error("Error cargando DOBLEs:", e);
      setDobles([]);
    } finally {
      setDoblesLoading(false);
    }
  }, [trimestre]);

  const cargarTalleres = useCallback(async () => {
    try {
      const list = await obtenerTalleres(undefined, true);
      setTalleres(list);
    } catch (e: unknown) {
      console.error("Error cargando talleres:", e);
      setTalleres([]);
    }
  }, []);

  useEffect(() => {
    if (trimestre) {
      cargarEmpresasDoble();
      cargarDobles();
      cargarTalleres();
    }
  }, [trimestre, cargarEmpresasDoble, cargarDobles, cargarTalleres]);

  // ── Computed views ───────────────────────────────────────────

  // DOBLEs grouped by empresa for the active week.
  const doblesPorEmpresa = useMemo(() => {
    const groups = new Map<number, SlotDobleResponse[]>();
    for (const d of dobles) {
      if (d.semana !== semana || d.empresa_id == null) continue;
      if (!groups.has(d.empresa_id)) groups.set(d.empresa_id, []);
      groups.get(d.empresa_id)!.push(d);
    }
    // Sort each empresa's list by (día, horario).
    for (const items of groups.values()) {
      items.sort((a, b) => {
        const da = DIAS_ORDEN.indexOf(a.dia as typeof DIAS_ORDEN[number]);
        const db = DIAS_ORDEN.indexOf(b.dia as typeof DIAS_ORDEN[number]);
        if (da !== db) return da - db;
        return a.horario.localeCompare(b.horario);
      });
    }
    return groups;
  }, [dobles, semana]);

  // Count of DOBLEs per week — drives the badge on each semana button.
  const doblesPorSemana = useMemo(() => {
    const counts = new Map<number, number>();
    for (const d of dobles) {
      counts.set(d.semana, (counts.get(d.semana) ?? 0) + 1);
    }
    return counts;
  }, [dobles]);

  // ── Modal helpers ────────────────────────────────────────────

  const openCreate = useCallback((empresaId: number) => {
    setModalMode("create");
    setModalSlotId(null);
    setModalForm({
      empresa_id: empresaId,
      semana,
      dia: null,
      horario: "",
      taller_id: null,
      notas: "",
    });
    setModalOpen(true);
  }, [semana]);

  const openEdit = useCallback((slot: SlotDobleResponse) => {
    setModalMode("edit");
    setModalSlotId(slot.id);
    setModalForm({
      empresa_id: slot.empresa_id,
      semana: slot.semana,
      dia: slot.dia,
      horario: slot.horario,
      taller_id: slot.taller_id,
      notas: slot.notas ?? "",
    });
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setSubmitting(false);
    setModalForm(EMPTY_FORM);
    setModalSlotId(null);
  }, []);

  const modalCanSubmit =
    modalForm.empresa_id != null &&
    modalForm.semana != null &&
    modalForm.semana >= 1 &&
    modalForm.semana <= 13 &&
    !!modalForm.dia &&
    !!modalForm.horario.trim() &&
    modalForm.taller_id != null;

  const handleSubmit = useCallback(async () => {
    if (!trimestre) return;
    if (
      modalForm.empresa_id == null ||
      modalForm.semana == null ||
      !modalForm.dia ||
      !modalForm.horario.trim() ||
      modalForm.taller_id == null
    ) {
      return;
    }

    setSubmitting(true);
    const notasVal = modalForm.notas.trim() ? modalForm.notas.trim() : null;

    if (modalMode === "create") {
      const body: CrearSlotDobleInput = {
        empresa_id: modalForm.empresa_id,
        semana: modalForm.semana,
        dia: modalForm.dia,
        horario: modalForm.horario.trim(),
        taller_id: modalForm.taller_id,
        notas: notasVal,
      };
      const result = await actionCrearDoble(trimestre, body);
      setSubmitting(false);
      if (result.ok) {
        toast.success(
          `DOBLE creado: S${modalForm.semana} ${modalForm.dia} ${modalForm.horario}`,
        );
        closeModal();
        await cargarDobles();
      } else {
        toast.error(result.error);
      }
    } else if (modalMode === "edit" && modalSlotId != null) {
      const body: EditarSlotDobleInput = {
        empresa_id: modalForm.empresa_id,
        semana: modalForm.semana,
        dia: modalForm.dia,
        horario: modalForm.horario.trim(),
        taller_id: modalForm.taller_id,
        notas: notasVal,
      };
      const result = await actionEditarDoble(modalSlotId, body);
      setSubmitting(false);
      if (result.ok) {
        toast.success("DOBLE actualizado");
        closeModal();
        await cargarDobles();
      } else {
        toast.error(result.error);
      }
    }
  }, [trimestre, modalForm, modalMode, modalSlotId, closeModal, cargarDobles]);

  // ── Delete ───────────────────────────────────────────────────

  const handleDelete = useCallback(async (slot: SlotDobleResponse) => {
    setDeletingId(slot.id);
    try {
      const result = await actionBorrarDoble(slot.id);
      if (!result.ok) throw new Error(result.error);
      toast.success(
        `DOBLE borrado: S${slot.semana} ${slot.dia} ${slot.horario} — ${slot.empresa_nombre ?? "(sin empresa)"}`,
      );
      setConfirmDelete(null);
      await cargarDobles();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al borrar DOBLE";
      toast.error(msg);
    } finally {
      setDeletingId(null);
    }
  }, [cargarDobles]);

  // ── Render ───────────────────────────────────────────────────

  if (loadingSettings) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Gestión Doble
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Talleres añadidos ad-hoc para empresas habilitadas con{" "}
            <code className="font-mono text-xs">puedeSerDoble</code> en su
            ficha. No consumen frecuencia, no validan colisión.
          </p>
        </div>
        <Link
          href="/planificacion/operacion"
          className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          ← Volver a Operación
        </Link>
      </div>

      {/* Trimestre selector */}
      <div className="rounded-lg bg-white p-4 shadow-sm border border-slate-200 space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-700">Trimestre</span>
          {trimestreOptions.length > 0 ? (
            <Select
              value={trimestre ?? ""}
              onValueChange={(v) => {
                setTrimestre(v);
                setSemana(1);
              }}
            >
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {trimestreOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-sm text-slate-400">Sin trimestres configurados</span>
          )}
        </div>

        {/* Semana selector — 1..13 buttons with DOBLE count badge */}
        <div>
          <div className="text-sm font-medium text-slate-700 mb-2">Semana</div>
          <div className="flex flex-wrap gap-2">
            {SEMANAS.map(sem => {
              const count = doblesPorSemana.get(sem) ?? 0;
              const isActive = sem === semana;
              return (
                <button
                  key={sem}
                  onClick={() => setSemana(sem)}
                  className={`relative flex flex-col items-center rounded-lg px-3 py-2 text-xs transition-all border min-w-13 ${
                    isActive
                      ? "border-yellow-400 bg-yellow-100 shadow-sm ring-2 ring-yellow-200"
                      : count > 0
                        ? "border-yellow-200 bg-yellow-50 hover:bg-yellow-100"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                  title={count > 0 ? `${count} DOBLE en S${sem}` : `Sin DOBLE en S${sem}`}
                >
                  {count > 0 && (
                    <span className="absolute -top-1 -left-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-yellow-400 px-1 text-[8px] font-bold text-yellow-900 ring-1 ring-yellow-600">
                      D{count > 1 ? `·${count}` : ""}
                    </span>
                  )}
                  <span className={`font-bold ${isActive ? "text-yellow-900" : "text-slate-600"}`}>
                    S{sem}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Empresas Doble load error */}
      {empresasDobleError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Error al cargar empresas elegibles para Doble: {empresasDobleError}
        </div>
      )}

      {/* Empty state when no DOBLE-eligible empresas */}
      {!empresasDobleError && empresasDoble.length === 0 && trimestre && (
        <div className="rounded-md border border-slate-200 bg-white p-8 text-center">
          <p className="text-sm text-slate-600">
            No hay empresas elegibles para Doble.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Marca el flag <code className="font-mono">puedeSerDoble</code> en
            la ficha de la empresa (sección Empresas) para habilitarla.
          </p>
          <Link
            href="/planificacion/empresas"
            className="mt-3 inline-block text-sm text-blue-600 hover:underline"
          >
            Ir a Empresas →
          </Link>
        </div>
      )}

      {/* Empresa cards */}
      {empresasDoble.map(emp => {
        const items = doblesPorEmpresa.get(emp.id) ?? [];
        return (
          <Card key={emp.id} className="border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">{emp.nombre}</CardTitle>
                <Badge variant="outline" className="text-[10px]">{emp.tipo}</Badge>
                <span className="text-xs text-slate-500">
                  S{semana} · {items.length} taller{items.length === 1 ? "" : "es"}
                </span>
              </div>
              <Button size="sm" onClick={() => openCreate(emp.id)} disabled={!trimestre}>
                + Añadir taller
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              {items.length === 0 ? (
                <p className="text-xs text-slate-400 py-2">
                  Sin talleres DOBLE en S{semana}.
                </p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-600 border-b border-slate-200">
                      <th className="py-1.5 pr-3 font-medium w-12">Día</th>
                      <th className="py-1.5 pr-3 font-medium w-20">Horario</th>
                      <th className="py-1.5 pr-3 font-medium">Taller</th>
                      <th className="py-1.5 pr-3 font-medium w-16">Programa</th>
                      <th className="py-1.5 pr-3 font-medium">Notas</th>
                      <th className="py-1.5 font-medium w-28 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(slot => (
                      <tr key={slot.id} className="border-b border-slate-100 last:border-b-0">
                        <td className="py-1.5 pr-3 font-mono text-slate-700">{slot.dia}</td>
                        <td className="py-1.5 pr-3 font-mono text-slate-700">{slot.horario}</td>
                        <td className="py-1.5 pr-3 text-slate-800">{slot.taller_nombre}</td>
                        <td className="py-1.5 pr-3">
                          <Badge variant="outline" className="text-[10px]">{slot.programa}</Badge>
                        </td>
                        <td className="py-1.5 pr-3 text-slate-600">{slot.notas ?? ""}</td>
                        <td className="py-1.5 text-right">
                          <button
                            onClick={() => openEdit(slot)}
                            className="text-xs px-2 py-1 rounded text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                            title="Editar este DOBLE"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => setConfirmDelete(slot)}
                            disabled={deletingId === slot.id}
                            className="ml-1 text-xs px-2 py-1 rounded text-red-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                            title="Borrar este DOBLE"
                          >
                            {deletingId === slot.id ? "..." : "Borrar"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        );
      })}

      {doblesLoading && (
        <div className="text-center text-xs text-slate-400 py-4">Cargando DOBLEs…</div>
      )}

      {/* Create / Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={(o) => (o ? setModalOpen(true) : closeModal())}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {modalMode === "create" ? "Añadir taller DOBLE" : "Editar taller DOBLE"}
            </DialogTitle>
            <DialogDescription>
              Talleres ad-hoc para semana intensiva. Sin validación de colisión
              ni programa — el planificador decide.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Empresa */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Empresa</label>
              <Select
                value={modalForm.empresa_id == null ? "" : String(modalForm.empresa_id)}
                onValueChange={(v) =>
                  setModalForm(f => ({ ...f, empresa_id: v ? Number(v) : null }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Empresa elegible para Doble" />
                </SelectTrigger>
                <SelectContent>
                  {empresasDoble.map(e => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      {e.nombre}{" "}
                      <span className="text-slate-500 text-xs">({e.tipo})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Semana / Día / Horario */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Semana</label>
                <Input
                  type="number"
                  min={1}
                  max={13}
                  value={modalForm.semana == null ? "" : modalForm.semana}
                  onChange={(e) =>
                    setModalForm(f => ({
                      ...f,
                      semana: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                  placeholder="1..13"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Día</label>
                <Select
                  value={modalForm.dia ?? ""}
                  onValueChange={(v) =>
                    setModalForm(f => ({ ...f, dia: v ? v : null }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Día" />
                  </SelectTrigger>
                  <SelectContent>
                    {DIAS_OPTIONS.map(d => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Horario</label>
                <Input
                  type="text"
                  value={modalForm.horario}
                  onChange={(e) =>
                    setModalForm(f => ({ ...f, horario: e.target.value }))
                  }
                  placeholder="HH:MM"
                />
              </div>
            </div>

            {/* Taller (libre programa) */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Taller</label>
              <Select
                value={modalForm.taller_id == null ? "" : String(modalForm.taller_id)}
                onValueChange={(v) =>
                  setModalForm(f => ({ ...f, taller_id: v ? Number(v) : null }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona taller del catálogo" />
                </SelectTrigger>
                <SelectContent>
                  {talleres.map(t => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.nombre}
                      <span className="text-slate-500 text-xs ml-2">
                        ({t.programa}
                        {t.dia_semana ? ` · ${t.dia_semana}` : ""}
                        {t.horario ? ` ${t.horario}` : ""})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Notas */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Notas (opcional)</label>
              <Textarea
                value={modalForm.notas}
                onChange={(e) =>
                  setModalForm(f => ({ ...f, notas: e.target.value }))
                }
                rows={2}
                placeholder="Contexto de la semana intensiva, observaciones…"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeModal} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={!modalCanSubmit || submitting}>
              {submitting
                ? "Guardando…"
                : modalMode === "create"
                  ? "Crear DOBLE"
                  : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog
        open={confirmDelete !== null}
        onOpenChange={(o) => { if (!o) setConfirmDelete(null); }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Borrar este DOBLE?</DialogTitle>
            <DialogDescription>
              {confirmDelete && (
                <span className="block text-sm">
                  {confirmDelete.empresa_nombre} — S{confirmDelete.semana}{" "}
                  {confirmDelete.dia} {confirmDelete.horario} — {confirmDelete.taller_nombre}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDelete(null)}
              disabled={deletingId !== null}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
              disabled={deletingId !== null}
            >
              {deletingId === confirmDelete?.id ? "Borrando…" : "Borrar DOBLE"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
