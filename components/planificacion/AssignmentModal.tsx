"use client";

import type { MotivoCambio } from "./MotivoCambioModal";

/**
 * V26 — Modal unificado para asignar/reasignar una empresa a un slot.
 *
 * Maneja los tres escenarios que produce `actionValidarAsignacion`:
 *   - warning_only:        slot vacante con violaciones → warnings + botón
 *                          "Asignar de todos modos" (sin selector de motivo,
 *                          el caller manda DECISION_PLANIFICADOR por defecto).
 *   - motivo_only:         reasignación SIN violaciones → solo selector de
 *                          motivo + botón "Confirmar cambio".
 *   - warning_with_motivo: reasignación CON violaciones → warnings y selector
 *                          de motivo en el MISMO modal, un único botón final.
 *
 * Es presentación pura: el caller mantiene `assignModal` y `selectedMotivo`
 * en su propio state y decide en `onConfirm` qué motivo enviar al backend.
 * El botón "Asignar de todos modos" queda deshabilitado mientras los modos
 * que requieren motivo no tengan uno seleccionado.
 *
 * Distinto de `SlotWarningsModal` (solo warnings, reutilizado por Editar/Crear
 * slot modal donde no hace falta motivo) y de `MotivoCambioModal` (solo motivo
 * con auto-confirm al hacer click, usado para cancelar slot).
 */

export type AssignModalType =
  | "warning_only"
  | "motivo_only"
  | "warning_with_motivo";

interface AssignmentModalProps {
  isOpen: boolean;
  type: AssignModalType;
  empresaNombre: string;
  warnings: string[];
  restriccionesVioladas: string[];
  selectedMotivo: MotivoCambio | null;
  onSelectMotivo: (motivo: MotivoCambio) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function AssignmentModal({
  isOpen,
  type,
  empresaNombre,
  warnings,
  restriccionesVioladas,
  selectedMotivo,
  onSelectMotivo,
  onConfirm,
  onCancel,
}: AssignmentModalProps) {
  if (!isOpen) return null;

  const showWarnings = type === "warning_only" || type === "warning_with_motivo";
  const showMotivo = type === "motivo_only" || type === "warning_with_motivo";
  const warningsSoft = warnings.filter((w) => !restriccionesVioladas.includes(w));
  const confirmDisabled = showMotivo && !selectedMotivo;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          {type === "motivo_only"
            ? "¿Por qué se cambia la empresa?"
            : "Confirmar asignación"}
        </h3>

        <p className="text-sm text-slate-600 mb-4">
          {type === "motivo_only" ? (
            <>
              Cambiar a <strong>{empresaNombre}</strong>. Selecciona el motivo
              del cambio.
            </>
          ) : (
            <>
              Asignar <strong>{empresaNombre}</strong> a este slot.
            </>
          )}
        </p>

        {showWarnings && (
          <div className="space-y-3 mb-4">
            {restriccionesVioladas.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <h4 className="text-sm font-semibold text-red-800 mb-2">
                  Restricciones duras
                </h4>
                <ul className="space-y-1.5">
                  {restriccionesVioladas.map((w, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm text-red-700"
                    >
                      <span className="shrink-0">🔴</span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {warningsSoft.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <h4 className="text-sm font-semibold text-amber-800 mb-2">
                  Preferencias no cumplidas
                </h4>
                <ul className="space-y-1.5">
                  {warningsSoft.map((w, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm text-amber-700"
                    >
                      <span className="shrink-0">🟡</span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {showMotivo && (
          <div className="mb-6">
            {type === "warning_with_motivo" && (
              <p className="text-sm text-slate-600 mb-3">
                Selecciona el motivo del cambio:
              </p>
            )}
            <div className="space-y-2">
              <button
                onClick={() => onSelectMotivo("EMPRESA_CANCELO")}
                className={`w-full flex items-center gap-3 p-3 border-2 rounded-lg transition-colors text-left ${
                  selectedMotivo === "EMPRESA_CANCELO"
                    ? "border-red-400 bg-red-50"
                    : "border-slate-200 hover:border-red-300 hover:bg-red-50"
                }`}
              >
                <span className="text-xl">🏢</span>
                <div>
                  <div className="font-medium text-slate-900">
                    La empresa canceló
                  </div>
                  <div className="text-xs text-slate-500">
                    Afecta la fiabilidad de la empresa original
                  </div>
                </div>
              </button>
              <button
                onClick={() => onSelectMotivo("DECISION_PLANIFICADOR")}
                className={`w-full flex items-center gap-3 p-3 border-2 rounded-lg transition-colors text-left ${
                  selectedMotivo === "DECISION_PLANIFICADOR"
                    ? "border-blue-400 bg-blue-50"
                    : "border-slate-200 hover:border-blue-300 hover:bg-blue-50"
                }`}
              >
                <span className="text-xl">📋</span>
                <div>
                  <div className="font-medium text-slate-900">
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

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={confirmDisabled}
            className={`px-4 py-2 text-sm text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              warnings.length > 0
                ? restriccionesVioladas.length > 0
                  ? "bg-red-500 hover:bg-red-600"
                  : "bg-amber-500 hover:bg-amber-600"
                : "bg-blue-500 hover:bg-blue-600"
            }`}
          >
            {warnings.length > 0 ? "Asignar de todos modos" : "Confirmar cambio"}
          </button>
        </div>
      </div>
    </div>
  );
}
