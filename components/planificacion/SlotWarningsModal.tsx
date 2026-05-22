"use client";

/**
 * V26 — Modal de warnings de restricciones para una asignación.
 *
 * Presentación pura: recibe los warnings ya separados en duros (rojo) y
 * blandos (ámbar) y los renderiza con un único botón "Asignar de todos modos".
 * No conoce motivos, ni APIs, ni state del page. El llamador decide qué hacer
 * con `onConfirm`.
 *
 * Si la asignación requiere también un motivo (caso V11 "warning_with_motivo"),
 * el llamador orquesta este modal seguido de `MotivoCambioModal` en cadena.
 */

interface SlotWarningsModalProps {
  isOpen: boolean;
  /** Empresa que se intenta asignar — aparece en el header del modal. */
  empresaNombre: string;
  /** Lista completa de warnings devueltos por validar-asignacion. */
  warnings: string[];
  /** Subconjunto que el backend marcó como restricciones duras. Se pintan
   *  en rojo; el resto en ámbar. Si está vacío, todo se pinta en ámbar. */
  restriccionesVioladas: string[];
  onConfirm: () => void;
  onCancel: () => void;
}

export function SlotWarningsModal({
  isOpen,
  empresaNombre,
  warnings,
  restriccionesVioladas,
  onConfirm,
  onCancel,
}: SlotWarningsModalProps) {
  if (!isOpen) return null;

  const tieneRestriccionesDuras = restriccionesVioladas.length > 0;
  const warningsSoft = warnings.filter(
    (w) => !restriccionesVioladas.includes(w),
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          Confirmar asignación
        </h3>

        <p className="text-sm text-slate-600 mb-4">
          Asignar <strong>{empresaNombre}</strong> a este slot.
        </p>

        <div className="space-y-3 mb-4">
          {tieneRestriccionesDuras && (
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

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm text-white rounded-lg transition-colors ${
              tieneRestriccionesDuras
                ? "bg-red-500 hover:bg-red-600"
                : "bg-amber-500 hover:bg-amber-600"
            }`}
          >
            Asignar de todos modos
          </button>
        </div>
      </div>
    </div>
  );
}
