"use client";

import type { RecorteDetalle } from "@/lib/api";

interface RecortesPanelProps {
  recortes: RecorteDetalle[];
}

export function RecortesPanel({ recortes }: RecortesPanelProps) {
  if (!recortes.length) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
      <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
        <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m7.848 8.25 1.536.887M7.848 8.25a3 3 0 1 1-5.196-3 3 3 0 0 1 5.196 3Zm1.536.887a2.165 2.165 0 0 1 1.083 1.839c.005.351.054.695.14 1.024M9.384 9.137l2.077 1.199M7.848 15.75l1.536-.887m-1.536.887a3 3 0 1 1-5.196 3 3 3 0 0 1 5.196-3Zm1.536-.887a2.165 2.165 0 0 0 1.083-1.838c.005-.352.054-.695.14-1.025m-1.223 2.863 2.077-1.199m0-3.328a4.323 4.323 0 0 1 2.068-1.379l5.325-1.628a4.5 4.5 0 0 1 2.48-.044l.803.215-7.794 4.5m-2.882-1.664A4.33 4.33 0 0 0 10.607 12m3.736 0 7.794 4.5-.802.215a4.5 4.5 0 0 1-2.48-.043l-5.326-1.629a4.324 4.324 0 0 1-2.068-1.379M14.343 12l-2.882 1.664" />
        </svg>
        Recortes aplicados
      </h4>
      <div className="mt-3 space-y-2">
        {recortes.map((r) => (
          <div
            key={r.empresa_id}
            className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2"
          >
            <div>
              <span className="text-sm font-medium text-slate-800">{r.nombre}</span>
              <span className="ml-2 text-xs text-slate-500">{r.motivo}</span>
            </div>
            <div className="flex items-center gap-3 text-xs tabular-nums">
              {r.ef_delta !== 0 && (
                <span className="text-red-600 font-semibold">
                  EF: {r.ef_original} → {r.ef_recortado}
                </span>
              )}
              {r.it_delta !== 0 && (
                <span className="text-red-600 font-semibold">
                  IT: {r.it_original} → {r.it_recortado}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}