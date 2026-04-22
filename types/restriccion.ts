/**
 * Restriccion (constraint) types.
 * Consolidated from lib/api.ts and actions/restricciones-actions.ts
 */

export type RestriccionTipo = "HARD" | "SOFT";
export type RestriccionClave =
  | "solo_dia"
  | "solo_taller"
  | "no_comodin"
  | "max_extras"
  | "franja_horaria"   // V16
  | "franja_por_dia";  // V16

export interface Restriccion {
  id: number;
  empresa_id: number;
  empresa_nombre: string;
  tipo: RestriccionTipo;
  clave: RestriccionClave;
  valor: string;
  taller_id: number | null;
  taller_nombre_ref: string | null;
  descripcion: string | null;
}

export interface RestriccionInput {
  tipo: RestriccionTipo;
  clave: RestriccionClave;
  valor: string;
  taller_id?: number | null;
  descripcion?: string;
}

/** Inline restriccion format used in FrecuenciaEmpresa */
export interface RestriccionInline {
  tipo: string;
  clave: string;
  valor: string;
}

// V16 — canonical lists shared with the CRUD form
export const FRANJAS_CANONICAS = [
  "09:30-11:30",
  "12:00-14:00",
  "15:00-17:00",
] as const;

export const DIAS_VALIDOS = ["L", "M", "X", "J", "V"] as const;

export type FranjaCanonica = (typeof FRANJAS_CANONICAS)[number];
export type DiaValido = (typeof DIAS_VALIDOS)[number];
