"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  actionActualizarSlot,
  actionEliminarSlot,
  actionValidarAsignacion,
} from "@/actions/calendario-actions";
import { SlotWarningsModal } from "./SlotWarningsModal";
import type {
  EstadoSlot,
  SlotCalendario,
  SlotUpdateInput,
} from "@/types/calendario";
import type { EmpresaSimple } from "@/types/empresa";
import type { TallerOut } from "@/types/taller";

/**
 * V26 — Modal unificado de edición de slot, compartido entre vista lista y
 * calendario mensual.
 *
 * Reemplaza el flujo de acciones sueltas (dropdown estado + botones inline)
 * cuando se entra desde el calendario mensual (click en mini-card). En la
 * vista lista coexiste con las acciones rápidas existentes; no se eliminan
 * todavía para mantener compatibilidad.
 *
 * Decisiones de diseño:
 * - Un único PATCH al guardar: si la planificadora cambió empresa + taller +
 *   notas a la vez, se valida solo el cambio de empresa (el solver es quien
 *   tiene restricciones sobre eso) y se envía un patch con todo. No hay
 *   guardados parciales.
 * - Estado y `confirmado` se mueven juntos (CONFIRMADO ⇒ confirmado=true,
 *   VACANTE/PLANIFICADO ⇒ confirmado=false), mirroring del page client.
 * - Motivo obligatorio si cambia la empresa o el estado pasa a CANCELADO.
 *   Reglas de write-once sobre `empresaIdOriginal` viven en backend.
 * - Modal de confirmación de eliminación se renderiza inline (overlay encima)
 *   para evitar otra capa de componente trivial.
 * - SlotWarningsModal (extraído en 1.5) se abre encima cuando la validación
 *   devuelve warnings; onConfirm reanuda el submit con el mismo patch.
 */

type MotivoCambio = "EMPRESA_CANCELO" | "DECISION_PLANIFICADOR";

interface EditarSlotModalProps {
  isOpen: boolean;
  slot: SlotCalendario | null;
  trimestre: string;
  empresas: EmpresaSimple[];
  talleres: TallerOut[];
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}

const ESTADO_OPTIONS: EstadoSlot[] = [
  "VACANTE",
  "PLANIFICADO",
  "CONFIRMADO",
  "CANCELADO",
];

export function EditarSlotModal({
  isOpen,
  slot,
  trimestre,
  empresas,
  talleres,
  onClose,
  onSuccess,
}: EditarSlotModalProps) {
  const [estado, setEstado] = useState<EstadoSlot>("PLANIFICADO");
  const [empresaId, setEmpresaId] = useState<number | null>(null);
  const [tallerId, setTallerId] = useState<number | null>(null);
  const [notas, setNotas] = useState<string>("");
  const [motivo, setMotivo] = useState<MotivoCambio | null>(null);

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);
  const [warningsModalState, setWarningsModalState] = useState<{
    warnings: string[];
    restriccionesVioladas: string[];
    pendingPatch: SlotUpdateInput;
    pendingEmpresaNombre: string;
  } | null>(null);

  // Reset form when a new slot is loaded.
  useEffect(() => {
    if (!slot) return;
    setEstado(slot.estado);
    setEmpresaId(slot.empresa_id);
    setTallerId(slot.taller_id);
    setNotas(slot.notas ?? "");
    setMotivo(null);
    setConfirmDelete(false);
    setWarningsModalState(null);
  }, [slot]);

  const empresasOrdenadas = useMemo(
    () => [...empresas].sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [empresas],
  );

  const talleresOrdenados = useMemo(
    () =>
      [...talleres].sort((a, b) => {
        if (a.programa !== b.programa) return a.programa.localeCompare(b.programa);
        return a.nombre.localeCompare(b.nombre);
      }),
    [talleres],
  );

  // Hooks must run unconditionally; render guard goes AFTER hooks.
  const empresaCambio = slot != null && empresaId !== slot.empresa_id;
  const estadoCambio = slot != null && estado !== slot.estado;
  const cambioRequiereMotivo =
    empresaCambio || (estadoCambio && estado === "CANCELADO");

  const buildPatch = useCallback((): SlotUpdateInput => {
    if (!slot) return {};
    const patch: SlotUpdateInput = {};
    if (estadoCambio) {
      patch.estado = estado;
      if (estado === "CONFIRMADO") patch.confirmado = true;
      if (estado === "PLANIFICADO" || estado === "VACANTE") {
        patch.confirmado = false;
      }
    }
    if (empresaCambio) patch.empresa_id = empresaId;
    if (tallerId !== slot.taller_id && tallerId != null) {
      patch.taller_id = tallerId;
    }
    if ((slot.notas ?? "") !== notas) {
      patch.notas = notas.length > 0 ? notas : null;
    }
    if (cambioRequiereMotivo && motivo) patch.motivo_cambio = motivo;
    return patch;
  }, [
    slot,
    estado,
    estadoCambio,
    empresaId,
    empresaCambio,
    tallerId,
    notas,
    motivo,
    cambioRequiereMotivo,
  ]);

  const applyPatch = useCallback(
    async (patch: SlotUpdateInput) => {
      if (!slot) return;
      setSubmitting(true);
      try {
        const result = await actionActualizarSlot(trimestre, slot.id, patch);
        if (!result.ok) throw new Error(result.error);
        toast.success("Slot actualizado");
        setWarningsModalState(null);
        await onSuccess();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Error al actualizar slot";
        toast.error(msg);
      } finally {
        setSubmitting(false);
      }
    },
    [slot, trimestre, onSuccess],
  );

  const handleSubmit = useCallback(async () => {
    if (!slot) return;
    const patch = buildPatch();

    if (Object.keys(patch).length === 0) {
      toast.info("No hay cambios para guardar");
      return;
    }

    if (cambioRequiereMotivo && !motivo) {
      toast.error("Selecciona el motivo del cambio");
      return;
    }

    // Only validate when the empresa actually changes to a real one. Liberar
    // (VACANTE / empresa_id=null) no atraviesa el validador del solver.
    if (empresaCambio && empresaId !== null) {
      try {
        const result = await actionValidarAsignacion(
          trimestre,
          slot.id,
          empresaId,
        );
        if (!result.ok) throw new Error(result.error);
        if (result.data.warnings.length > 0) {
          const empresaNombre =
            empresasOrdenadas.find((e) => e.id === empresaId)?.nombre ??
            "(empresa)";
          setWarningsModalState({
            warnings: result.data.warnings,
            restriccionesVioladas: result.data.restricciones_violadas,
            pendingPatch: patch,
            pendingEmpresaNombre: empresaNombre,
          });
          return;
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Error al validar asignación";
        toast.error(msg);
        return;
      }
    }

    await applyPatch(patch);
  }, [
    slot,
    buildPatch,
    cambioRequiereMotivo,
    motivo,
    empresaCambio,
    empresaId,
    trimestre,
    empresasOrdenadas,
    applyPatch,
  ]);

  const handleDelete = useCallback(async () => {
    if (!slot) return;
    setDeleting(true);
    try {
      const result = await actionEliminarSlot(trimestre, slot.id);
      if (!result.ok) throw new Error(result.error);
      const extra =
        result.data.had_motivo_cambio || result.data.was_confirmado
          ? " (tenía cambios registrados)"
          : "";
      toast.success(`Slot ${result.data.tipo_asignacion} eliminado${extra}`);
      setConfirmDelete(false);
      await onSuccess();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al eliminar slot";
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  }, [slot, trimestre, onSuccess]);

  if (!isOpen || !slot) return null;

  const slotHeader = `S${slot.semana} · ${slot.dia} · ${slot.horario} · ${slot.programa}`;
  const empresaOriginalLabel =
    slot.empresa_nombre_original && slot.empresa_id_original !== slot.empresa_id
      ? slot.empresa_nombre_original
      : null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Editar slot
              </h3>
              <p className="text-xs text-slate-500 mt-1">{slotHeader}</p>
            </div>
            <button
              onClick={onClose}
              disabled={submitting || deleting}
              className="text-slate-400 hover:text-slate-600 disabled:opacity-50"
              aria-label="Cerrar"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            {/* Estado */}
            <div className="space-y-1.5">
              <label
                className="text-sm font-medium text-slate-700"
                htmlFor="edit-estado"
              >
                Estado
              </label>
              <select
                id="edit-estado"
                value={estado}
                onChange={(e) => setEstado(e.target.value as EstadoSlot)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
              >
                {ESTADO_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {/* Empresa */}
            <div className="space-y-1.5">
              <label
                className="text-sm font-medium text-slate-700"
                htmlFor="edit-empresa"
              >
                Empresa
              </label>
              <select
                id="edit-empresa"
                value={empresaId == null ? "" : String(empresaId)}
                onChange={(e) =>
                  setEmpresaId(e.target.value ? Number(e.target.value) : null)
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
              >
                <option value="">(Sin empresa)</option>
                {empresasOrdenadas.map((e) => (
                  <option key={e.id} value={String(e.id)}>
                    {e.nombre}
                  </option>
                ))}
              </select>
              {empresaOriginalLabel && (
                <p className="text-xs text-slate-500">
                  Empresa original: {empresaOriginalLabel}
                </p>
              )}
            </div>

            {/* Taller */}
            <div className="space-y-1.5">
              <label
                className="text-sm font-medium text-slate-700"
                htmlFor="edit-taller"
              >
                Taller
              </label>
              <select
                id="edit-taller"
                value={tallerId == null ? "" : String(tallerId)}
                onChange={(e) =>
                  setTallerId(e.target.value ? Number(e.target.value) : null)
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
              >
                {talleresOrdenados.map((t) => (
                  <option key={t.id} value={String(t.id)}>
                    [{t.programa}] {t.nombre}
                  </option>
                ))}
              </select>
            </div>

            {/* Notas */}
            <div className="space-y-1.5">
              <label
                className="text-sm font-medium text-slate-700"
                htmlFor="edit-notas"
              >
                Notas
              </label>
              <textarea
                id="edit-notas"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none resize-y"
              />
            </div>

            {/* Motivo — solo si hay cambio que lo requiere */}
            {cambioRequiereMotivo && (
              <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm font-medium text-amber-900">
                  Motivo del cambio
                </p>
                <p className="text-xs text-amber-700">
                  {empresaCambio
                    ? "Cambiar la empresa requiere registrar el motivo."
                    : "Cancelar el slot requiere registrar el motivo."}
                </p>
                <div className="space-y-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setMotivo("EMPRESA_CANCELO")}
                    className={`w-full flex items-center gap-3 p-3 border-2 rounded-lg transition-colors text-left ${
                      motivo === "EMPRESA_CANCELO"
                        ? "border-red-400 bg-red-50"
                        : "border-slate-200 bg-white hover:border-red-300 hover:bg-red-50"
                    }`}
                  >
                    <span className="text-xl">🏢</span>
                    <div>
                      <div className="font-medium text-slate-900 text-sm">
                        La empresa canceló
                      </div>
                      <div className="text-xs text-slate-500">
                        Afecta la fiabilidad de la empresa original
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMotivo("DECISION_PLANIFICADOR")}
                    className={`w-full flex items-center gap-3 p-3 border-2 rounded-lg transition-colors text-left ${
                      motivo === "DECISION_PLANIFICADOR"
                        ? "border-blue-400 bg-blue-50"
                        : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50"
                    }`}
                  >
                    <span className="text-xl">📋</span>
                    <div>
                      <div className="font-medium text-slate-900 text-sm">
                        Decisión del planificador
                      </div>
                      <div className="text-xs text-slate-500">
                        No afecta la fiabilidad de la empresa original
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Información read-only */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
              <div>
                <span className="font-medium">Tipo asignación:</span>{" "}
                {slot.tipo_asignacion}
              </div>
              <div>
                <span className="font-medium">Confirmado:</span>{" "}
                {slot.confirmado ? "Sí" : "No"}
              </div>
              {slot.motivo_cambio && (
                <div>
                  <span className="font-medium">Último motivo:</span>{" "}
                  {slot.motivo_cambio}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 mt-6">
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={submitting || deleting}
              className="px-4 py-2 text-sm text-red-600 hover:text-red-700 border border-red-300 rounded-lg hover:bg-red-50 disabled:opacity-50"
            >
              Eliminar slot
            </button>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting || deleting}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || deleting}
                className="px-4 py-2 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-50"
              >
                {submitting ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirm delete overlay */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
            <h4 className="text-lg font-semibold text-slate-900 mb-2">
              ¿Eliminar slot?
            </h4>
            <p className="text-sm text-slate-600 mb-4">
              {`Eliminar el slot ${slotHeader}${
                slot.empresa_nombre ? ` de ${slot.empresa_nombre}` : ""
              }. Esta acción no se puede deshacer.`}
            </p>
            {(slot.confirmado || slot.motivo_cambio) && (
              <p className="text-xs text-amber-700 mb-4">
                Este slot tiene cambios registrados. Se eliminará igual.
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm text-white bg-red-500 hover:bg-red-600 rounded-lg disabled:opacity-50"
              >
                {deleting ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Warnings overlay — appears when empresa change has validation warnings */}
      <SlotWarningsModal
        isOpen={warningsModalState !== null}
        empresaNombre={warningsModalState?.pendingEmpresaNombre ?? ""}
        warnings={warningsModalState?.warnings ?? []}
        restriccionesVioladas={warningsModalState?.restriccionesVioladas ?? []}
        onConfirm={() => {
          if (warningsModalState) {
            void applyPatch(warningsModalState.pendingPatch);
          }
        }}
        onCancel={() => setWarningsModalState(null)}
      />
    </>
  );
}
