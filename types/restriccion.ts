/**
 * Restriccion (constraint) types.
 * Consolidated from lib/api.ts and actions/restricciones-actions.ts
 */

export type RestriccionTipo = "HARD" | "SOFT";
export type RestriccionClave = "solo_dia" | "solo_taller" | "no_comodin" | "max_extras";

export interface Restriccion {
  id: number;
  empresa_id: number;
  empresa_nombre: string;
  tipo: RestriccionTipo;
  clave: RestriccionClave;
  valor: string;
  descripcion: string | null;
}

export interface RestriccionInput {
  tipo: RestriccionTipo;
  clave: RestriccionClave;
  valor: string;
  descripcion?: string;
}

/** Inline restriccion format used in FrecuenciaEmpresa */
export interface RestriccionInline {
  tipo: string;
  clave: string;
  valor: string;
}
