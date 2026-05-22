"use client";

import { useEffect, useRef } from "react";

import type { ValidacionItem, ValidarCTResponse } from "@/types/config-trimestral";

/**
 * V27 — Modal de resultados de pre-validación de Config Trimestral.
 *
 * Tres modos visuales según el response:
 *   - `success` (0 err, 0 warn): banner verde compacto, autofoco en Cerrar.
 *   - `warnings-only`: banner ámbar con lista de warnings, sin tip de solver.
 *   - `errors`: sección errores roja primero, warnings ámbar después, tip
 *     final recordando que los errores van a hacer INFEASIBLE al solver.
 *
 * Cada item es clickable: dispara `onClickEmpresa(empresa_id)` y cierra el
 * modal. El page decide qué hacer (scrollIntoView + highlight, o toast info
 * si la empresa está filtrada fuera de vista).
 *
 * Es informativo: NO bloquea ningún botón del page, solo reporta. El botón
 * "Generar calendario" sigue funcionando aunque haya errores.
 */

interface ValidacionCTModalProps {
  isOpen: boolean;
  result: ValidarCTResponse | null;
  onClose: () => void;
  onClickEmpresa: (empresaId: number) => void;
}

export function ValidacionCTModal({
  isOpen,
  result,
  onClose,
  onClickEmpresa,
}: ValidacionCTModalProps) {
  const cerrarRef = useRef<HTMLButtonElement>(null);

  // Autofocus en Cerrar (única acción en el modo success y consistente en el
  // resto; la planificadora puede cerrar con Enter sin mover el mouse).
  useEffect(() => {
    if (!isOpen) return;
    cerrarRef.current?.focus();
  }, [isOpen, result]);

  if (!isOpen || !result) return null;

  const hasErrores = result.errores.length > 0;
  const hasWarnings = result.warnings.length > 0;
  const allClean = !hasErrores && !hasWarnings;

  const handleItemClick = (empresaId: number) => {
    onClickEmpresa(empresaId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between p-6 pb-4 border-b border-slate-200">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Validación de configuración {result.trimestre}
            </h3>
            <p className="text-xs text-slate-500 mt-1">{result.resumen}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
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

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {allClean && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
              <p className="text-2xl mb-2">✅</p>
              <p className="text-sm font-medium text-green-800">
                Todo OK.
              </p>
              <p className="text-xs text-green-700 mt-1">
                {result.total_empresas_revisadas} empresa
                {result.total_empresas_revisadas === 1 ? "" : "s"} revisada
                {result.total_empresas_revisadas === 1 ? "" : "s"}, sin
                inconsistencias detectadas.
              </p>
            </div>
          )}

          {hasErrores && (
            <ValidacionSection
              titulo={`Errores (${result.errores.length})`}
              items={result.errores}
              colorClass="border-red-200 bg-red-50"
              titleClass="text-red-800"
              icon="❌"
              onClickItem={handleItemClick}
            />
          )}

          {hasWarnings && (
            <ValidacionSection
              titulo={`Warnings (${result.warnings.length})`}
              items={result.warnings}
              colorClass="border-amber-200 bg-amber-50"
              titleClass="text-amber-800"
              icon="⚠️"
              onClickItem={handleItemClick}
            />
          )}

          {hasErrores && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              <strong>Tip:</strong> los errores van a hacer que el solver
              falle con INFEASIBLE. Corregilos antes de generar el calendario.
            </div>
          )}

          {!allClean && !hasErrores && hasWarnings && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              Configuración válida con {result.warnings.length} advertencia
              {result.warnings.length === 1 ? "" : "s"} informativa
              {result.warnings.length === 1 ? "" : "s"}. La generación de
              calendario debería funcionar.
            </div>
          )}
        </div>

        <div className="flex justify-end p-6 pt-4 border-t border-slate-200">
          <button
            ref={cerrarRef}
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

interface ValidacionSectionProps {
  titulo: string;
  items: ValidacionItem[];
  colorClass: string;
  titleClass: string;
  icon: string;
  onClickItem: (empresaId: number) => void;
}

function ValidacionSection({
  titulo,
  items,
  colorClass,
  titleClass,
  icon,
  onClickItem,
}: ValidacionSectionProps) {
  return (
    <div className={`rounded-lg border ${colorClass}`}>
      <div className={`px-4 py-2 border-b border-current/10 ${titleClass}`}>
        <h4 className="text-sm font-semibold">{titulo}</h4>
      </div>
      <ul className="divide-y divide-current/10">
        {items.map((item, i) => (
          <li key={`${item.empresa_id}-${item.tipo}-${i}`}>
            <button
              type="button"
              onClick={() => onClickItem(item.empresa_id)}
              className="w-full text-left px-4 py-3 hover:bg-white/40 transition-colors focus:outline-none focus:bg-white/60"
              title="Ir a esta empresa en la tabla"
            >
              <div className="flex items-start gap-2">
                <span className="shrink-0 text-base leading-none">{icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900">
                    {item.empresa_nombre}
                  </div>
                  <div className="text-xs text-slate-700 mt-1">
                    {item.detalle}
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    <span className="mr-1">💡</span>
                    {item.sugerencia}
                  </div>
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
