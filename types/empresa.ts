/**
 * Empresa (company) types.
 * Consolidated from lib/api.ts and actions/empresas-actions.ts
 */

// ── Core Types ───────────────────────────────────────────────

export interface Empresa {
  id: number;
  nombre: string;
  tipo: "EF" | "IT" | "AMBAS";
  semaforo: "VERDE" | "AMBAR" | "ROJO";
  scoreV3: number;
  fiabilidadReciente: number;
  esComodin: boolean;
  aceptaExtras: boolean;
  maxExtrasTrimestre: number;
  prioridadReduccion: "ALTA" | "MEDIA" | "BAJA";
  tieneBolsa: boolean;
  turnoPreferido: string | null;
  activa: boolean;
  notas: string | null;
}

/** Alias for backwards compatibility with lib/api.ts */
export type EmpresaFull = Empresa;

export interface EmpresaDetalle extends Empresa {
  createdAt: string;
  updatedAt: string;
}

// ── Input Types ──────────────────────────────────────────────

export interface EmpresaCreateInput {
  nombre: string;
  tipo?: string;
  semaforo?: string;
  scoreV3?: number;
  fiabilidadReciente?: number;
  esComodin?: boolean;
  aceptaExtras?: boolean;
  maxExtrasTrimestre?: number;
  prioridadReduccion?: string;
  tieneBolsa?: boolean;
  turnoPreferido?: string | null;
  notas?: string | null;
}

/** Alias for backwards compatibility with actions */
export type EmpresaInput = EmpresaCreateInput;

export interface EmpresaUpdateInput {
  nombre?: string;
  tipo?: string;
  semaforo?: string;
  scoreV3?: number;
  fiabilidadReciente?: number;
  esComodin?: boolean;
  aceptaExtras?: boolean;
  maxExtrasTrimestre?: number;
  prioridadReduccion?: string;
  tieneBolsa?: boolean;
  turnoPreferido?: string | null;
  notas?: string | null;
}

// ── Related Types ────────────────────────────────────────────

export interface RestriccionResumen {
  id: number;
  tipo: string;
  clave: string;
  valor: string;
  descripcion: string | null;
}

export interface CiudadResumen {
  id: number;
  nombre: string;
  activaReciente: boolean;
}

export interface HistoricoResumen {
  trimestre: string;
  total: number;
  ok: number;
  cancelados: number;
}

// ── Composite Types ──────────────────────────────────────────

export interface EmpresaDetalleCompleto {
  empresa: EmpresaDetalle;
  restricciones: RestriccionResumen[];
  ciudades: CiudadResumen[];
  historico_reciente: HistoricoResumen[];
}

/** Simple empresa reference (id + nombre) */
export interface EmpresaSimple {
  id: number;
  nombre: string;
}
