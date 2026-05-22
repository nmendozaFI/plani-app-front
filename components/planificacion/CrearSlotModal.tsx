"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { actionCrearSlot } from "@/actions/calendario-actions";
import type { CrearSlotInput } from "@/types/calendario";
import type { EmpresaFull } from "@/types/empresa";
import type { TallerOut } from "@/types/taller";
import type { CrearSlotPrefill } from "@/hooks/use-crear-slot-modal";

/**
 * V26 — Modal de creación de slot puntual desde el calendario mensual.
 *
 * Se abre con día/hora prellenados desde el botón "+ HH:MM" de la celda. La
 * planificadora elige tipo de asignación, programa, empresa, taller, y
 * opcionalmente notas.
 *
 * Orden de campos (post-validación V26): tipoAsignacion arriba → programa
 * (EF/IT) → empresa → taller → notas. El tipoAsignacion controla el bloqueo
 * del selector de programa:
 *   - BASE + franja con 1 slot ⇒ programa bloqueado al opuesto (plan base no
 *     permite duplicar tipo en una franja).
 *   - EXTRA ⇒ programa libre (un EXTRA puede ir encima del mismo tipo, igual
 *     que el "+ Añadir EXTRA" del header).
 *
 * Defaults dinámicos:
 *   - El selector EF/IT arranca en el tipo libre cuando hay sugerido.
 *   - BASE/EXTRA arranca según la empresa elegida (`puedeSerEP=true` ⇒ EXTRA),
 *     respetando override manual con `touchedTipoAsignacion`.
 *   - Si la planificadora vuelve a BASE con un programa ya inválido para la
 *     franja, se auto-corrige al opuesto-libre y se muestra un aviso inline
 *     debajo del selector (no toast, no submit silencioso).
 *
 * No se cruza con `CrearExtraModal` (botón "+ Añadir EXTRA rápido" del header
 * de Operación): aquel sigue siendo el atajo sin contexto de celda. Este es
 * el flujo "vi una franja libre, quiero llenarla".
 */

type ProgramaTipo = "EF" | "IT";
type TipoAsignacion = "BASE" | "EXTRA";

interface CrearSlotModalProps {
  isOpen: boolean;
  prefill: CrearSlotPrefill | null;
  trimestre: string;
  empresas: EmpresaFull[];
  talleres: TallerOut[];
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}

export function CrearSlotModal({
  isOpen,
  prefill,
  trimestre,
  empresas,
  talleres,
  onClose,
  onSuccess,
}: CrearSlotModalProps) {
  const [programa, setPrograma] = useState<ProgramaTipo>("EF");
  const [empresaId, setEmpresaId] = useState<number | null>(null);
  const [tallerId, setTallerId] = useState<number | null>(null);
  const [tipoAsignacion, setTipoAsignacion] = useState<TipoAsignacion>("BASE");
  const [touchedTipoAsignacion, setTouchedTipoAsignacion] =
    useState<boolean>(false);
  const [notas, setNotas] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [autoCorrectedMsg, setAutoCorrectedMsg] = useState<string | null>(null);

  // Reset form when a new prefill arrives (modal opens or moves to another franja).
  useEffect(() => {
    if (!prefill) return;
    const initialPrograma: ProgramaTipo =
      prefill.tipoSugerido === "EF"
        ? "IT"
        : prefill.tipoSugerido === "IT"
          ? "EF"
          : "EF";
    setPrograma(initialPrograma);
    setEmpresaId(null);
    setTallerId(null);
    setTipoAsignacion("BASE");
    setTouchedTipoAsignacion(false);
    setNotas("");
    setAutoCorrectedMsg(null);
  }, [prefill]);

  const empresasOrdenadas = useMemo(
    () => [...empresas].sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [empresas],
  );

  const talleresFiltrados = useMemo(
    () =>
      talleres
        .filter((t) => t.activo && t.programa === programa)
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [talleres, programa],
  );

  // Default BASE/EXTRA dinámico cuando la planificadora cambia de empresa,
  // siempre que no haya tocado manualmente el toggle.
  useEffect(() => {
    if (touchedTipoAsignacion) return;
    if (empresaId == null) return;
    const empresa = empresas.find((e) => e.id === empresaId);
    if (!empresa) return;
    setTipoAsignacion(empresa.puedeSerEP ? "EXTRA" : "BASE");
  }, [empresaId, empresas, touchedTipoAsignacion]);

  // Si la planificadora cambia el programa (EF↔IT) y el taller elegido ya no
  // pertenece al programa nuevo, lo limpiamos para evitar payload incoherente.
  useEffect(() => {
    if (tallerId == null) return;
    const taller = talleres.find((t) => t.id === tallerId);
    if (!taller || taller.programa !== programa) {
      setTallerId(null);
    }
  }, [programa, tallerId, talleres]);

  // Bloqueo del selector EF/IT: solo si tipoAsignacion=BASE y la franja ya
  // tiene un slot. Un EXTRA puede ir sobre cualquier programa, libre.
  const isTypeLocked =
    tipoAsignacion === "BASE" && prefill?.tipoSugerido != null;

  const handleSelectTipoAsignacion = useCallback(
    (next: TipoAsignacion) => {
      setTipoAsignacion(next);
      setTouchedTipoAsignacion(true);
      if (
        next === "BASE" &&
        prefill?.tipoSugerido != null &&
        programa === prefill.tipoSugerido
      ) {
        const opuesto: ProgramaTipo =
          prefill.tipoSugerido === "EF" ? "IT" : "EF";
        setPrograma(opuesto);
        setAutoCorrectedMsg(
          `Auto-cambiado a ${opuesto}: BASE no permite duplicar ${prefill.tipoSugerido} en esta franja.`,
        );
      } else {
        setAutoCorrectedMsg(null);
      }
    },
    [prefill, programa],
  );

  const handleSelectPrograma = useCallback(
    (next: ProgramaTipo) => {
      if (isTypeLocked && next !== programa) return;
      setPrograma(next);
      setAutoCorrectedMsg(null);
    },
    [isTypeLocked, programa],
  );

  const tipoHelperText = useMemo(() => {
    if (autoCorrectedMsg) return autoCorrectedMsg;
    if (!prefill?.tipoSugerido) return null;
    if (tipoAsignacion === "EXTRA") {
      return `La franja ya tiene un slot ${prefill.tipoSugerido} — se añadirá como EXTRA encima.`;
    }
    return `La franja ya tiene un slot ${prefill.tipoSugerido}; este se crea ${programa}.`;
  }, [autoCorrectedMsg, prefill, tipoAsignacion, programa]);

  const handleSubmit = useCallback(async () => {
    if (!prefill || empresaId == null || tallerId == null) return;
    const taller = talleres.find((t) => t.id === tallerId);
    if (!taller) {
      toast.error("Taller seleccionado no encontrado en el catálogo");
      return;
    }
    const body: CrearSlotInput = {
      empresa_id: empresaId,
      semana: prefill.semana,
      dia: prefill.dia,
      horario: prefill.horario,
      taller_id: tallerId,
      programa,
      tipo_asignacion: tipoAsignacion,
      notas: notas.trim() ? notas.trim() : null,
    };

    setSubmitting(true);
    try {
      const result = await actionCrearSlot(trimestre, body);
      if (!result.ok) throw new Error(result.error);
      const empresa = empresas.find((e) => e.id === empresaId);
      toast.success(
        `Slot ${tipoAsignacion} creado: ${empresa?.nombre ?? "(empresa)"} en S${prefill.semana} ${prefill.dia} ${prefill.horario}`,
      );
      await onSuccess();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al crear slot";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }, [
    prefill,
    empresaId,
    tallerId,
    talleres,
    programa,
    tipoAsignacion,
    notas,
    trimestre,
    empresas,
    onSuccess,
  ]);

  if (!isOpen || !prefill) return null;

  const canSubmit = empresaId != null && tallerId != null && !submitting;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Crear slot
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              S{prefill.semana} · {prefill.dia} · {prefill.horario}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
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
          {/* Tipo de asignación (BASE / EXTRA) — primero para que decida el
              bloqueo del selector de programa que viene a continuación. */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Tipo de asignación
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleSelectTipoAsignacion("BASE")}
                className={`p-3 border-2 rounded-lg text-left transition-colors ${
                  tipoAsignacion === "BASE"
                    ? "border-blue-400 bg-blue-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
                title="Forma parte del plan original"
              >
                <div className="font-medium text-sm text-slate-900">
                  Parte del plan base
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Forma parte del plan original
                </div>
              </button>
              <button
                type="button"
                onClick={() => handleSelectTipoAsignacion("EXTRA")}
                className={`p-3 border-2 rounded-lg text-left transition-colors ${
                  tipoAsignacion === "EXTRA"
                    ? "border-amber-400 bg-amber-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
                title="Se añade sobre el plan, típico de empresas con escuela propia"
              >
                <div className="font-medium text-sm text-slate-900">
                  Extra adicional
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Se añade sobre el plan, típico de empresas con escuela propia
                </div>
              </button>
            </div>
          </div>

          {/* Programa (EF / IT) — bloqueo dinámico según tipoAsignacion. */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Tipo</label>
            <div className="flex gap-2">
              {(["EF", "IT"] as const).map((tipo) => {
                const disabled = isTypeLocked && tipo !== programa;
                return (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => handleSelectPrograma(tipo)}
                    disabled={disabled}
                    className={`flex-1 px-4 py-2 text-sm rounded-lg border-2 transition-colors ${
                      programa === tipo
                        ? "border-blue-400 bg-blue-50 text-slate-900 font-medium"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {tipo}
                  </button>
                );
              })}
            </div>
            {tipoHelperText && (
              <p
                className={`text-xs ${
                  autoCorrectedMsg
                    ? "text-amber-700"
                    : tipoAsignacion === "EXTRA"
                      ? "text-amber-600"
                      : "text-slate-500"
                }`}
              >
                {tipoHelperText}
              </p>
            )}
          </div>

          {/* Empresa */}
          <div className="space-y-1.5">
            <label
              htmlFor="crear-empresa"
              className="text-sm font-medium text-slate-700"
            >
              Empresa
            </label>
            <select
              id="crear-empresa"
              value={empresaId == null ? "" : String(empresaId)}
              onChange={(e) =>
                setEmpresaId(e.target.value ? Number(e.target.value) : null)
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
            >
              <option value="">Selecciona una empresa</option>
              {empresasOrdenadas.map((e) => (
                <option key={e.id} value={String(e.id)}>
                  {e.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Taller */}
          <div className="space-y-1.5">
            <label
              htmlFor="crear-taller"
              className="text-sm font-medium text-slate-700"
            >
              Taller
            </label>
            <select
              id="crear-taller"
              value={tallerId == null ? "" : String(tallerId)}
              onChange={(e) =>
                setTallerId(e.target.value ? Number(e.target.value) : null)
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
            >
              <option value="">Selecciona un taller {programa}</option>
              {talleresFiltrados.map((t) => (
                <option key={t.id} value={String(t.id)}>
                  {t.nombre}
                </option>
              ))}
            </select>
            {talleresFiltrados.length === 0 && (
              <p className="text-xs text-amber-600">
                No hay talleres {programa} activos en el catálogo.
              </p>
            )}
          </div>

          {/* Notas */}
          <div className="space-y-1.5">
            <label
              htmlFor="crear-notas"
              className="text-sm font-medium text-slate-700"
            >
              Notas
            </label>
            <textarea
              id="crear-notas"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none resize-y"
              placeholder="Opcional"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-4 py-2 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Creando..." : "Crear slot"}
          </button>
        </div>
      </div>
    </div>
  );
}
