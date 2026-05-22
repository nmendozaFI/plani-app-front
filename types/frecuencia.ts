/**
 * Frecuencia (Phase 1) types.
 * Extracted from lib/api.ts
 */

import type { RestriccionInline } from "./restriccion";

export interface FrecuenciaEmpresa {
  empresa_id: number;
  nombre: string;
  talleres_ef: number;
  talleres_it: number;
  total: number;
  semaforo: string;
  score: number;
  ajuste_desempeno: number;
  es_nueva: boolean;
  es_comodin: boolean;
  prioridad_reduccion: string;
  ciudades_activas: string[];
  restricciones: RestriccionInline[];
  // V26: campo sugerido por el backend cuando CT.frecuenciaEF / frecuenciaIT
  // es NULL. El wizard pinta un badge "sugerido" al lado del input. Optional
  // por compat con backends pre-V26.
  sugerido_ef?: boolean;
  sugerido_it?: boolean;
}

export interface RecorteDetalle {
  empresa_id: number;
  nombre: string;
  ef_original: number;
  it_original: number;
  ef_recortado: number;
  it_recortado: number;
  ef_delta: number;
  it_delta: number;
  motivo: string;
}

export interface FrecuenciaOutput {
  trimestre: string;
  total_ef: number;
  total_it: number;
  max_ef: number;
  max_it: number;
  semanas_disponibles: number;
  max_ef_trimestre: number;
  max_it_trimestre: number;
  exceso_ef: number;
  exceso_it: number;
  empresas: FrecuenciaEmpresa[];
  recortes: RecorteDetalle[];
  warnings: string[];
  status: string;
}

export interface ConfirmarEmpresa {
  empresa_id: number;
  talleres_ef: number;
  talleres_it: number;
}

export interface ConfirmarOutput {
  status: string;
  trimestre: string;
  total_ef: number;
  total_it: number;
  empresas: {
    empresa_id: number;
    nombre: string;
    talleres_ef: number;
    talleres_it: number;
    total: number;
  }[];
  // V24 (Cambio B, decisión D5): contador de empresas con talleres_ef=0 y
  // talleres_it=0 que NO se insertaron en la tabla `frecuencia`. Campo
  // optional para compat con respuestas pre-V24 (donde no existía).
  empresas_omitidas?: number;
}
