"use client";

/**
 * V26 — Modal genérico para pedir un motivo de cambio (EMPRESA_CANCELO o
 * DECISION_PLANIFICADOR).
 *
 * Reemplaza el `cancelModal` inline y el selector de motivo embebido en el
 * antiguo `assignModal` del OperacionPageClient. Lo consume también el
 * EditarSlotModal del Paso 2 cuando la planificadora cambia empresa o
 * cancela el slot.
 *
 * Click en cualquiera de los dos botones de motivo confirma directamente —
 * no hay paso intermedio "Confirmar" porque la selección ES la decisión.
 */

export type MotivoCambio = "EMPRESA_CANCELO" | "DECISION_PLANIFICADOR";

interface MotivoCambioModalProps {
  isOpen: boolean;
  titulo: string;
  /** Texto explicativo opcional debajo del título. */
  descripcion?: string;
  onConfirm: (motivo: MotivoCambio) => void;
  onCancel: () => void;
}

export function MotivoCambioModal({
  isOpen,
  titulo,
  descripcion,
  onConfirm,
  onCancel,
}: MotivoCambioModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">{titulo}</h3>

        {descripcion && (
          <p className="text-sm text-slate-600 mb-6">{descripcion}</p>
        )}

        <div className="space-y-3 mb-6">
          <button
            onClick={() => onConfirm("EMPRESA_CANCELO")}
            className="w-full flex items-center gap-3 p-4 border-2 border-slate-200 rounded-lg hover:border-red-300 hover:bg-red-50 transition-colors text-left"
          >
            <span className="text-2xl">🏢</span>
            <div>
              <div className="font-medium text-slate-900">
                La empresa canceló
              </div>
              <div className="text-xs text-slate-500">
                Afecta la fiabilidad de la empresa
              </div>
            </div>
          </button>
          <button
            onClick={() => onConfirm("DECISION_PLANIFICADOR")}
            className="w-full flex items-center gap-3 p-4 border-2 border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
          >
            <span className="text-2xl">📋</span>
            <div>
              <div className="font-medium text-slate-900">
                Decisión del planificador
              </div>
              <div className="text-xs text-slate-500">
                No afecta la fiabilidad de la empresa
              </div>
            </div>
          </button>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
