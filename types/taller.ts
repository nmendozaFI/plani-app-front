/**
 * Taller (workshop) types.
 * Extracted from lib/api.ts
 */

export interface TallerOut {
  id: number;
  nombre: string;
  programa: string;
  dia_semana: string | null;
  horario: string | null;
  turno: string | null;
  es_contratante: boolean;
  descripcion: string | null;
  activo: boolean;
}

export interface TallerCreate {
  nombre: string;
  programa: string;
  dia_semana?: string | null;
  horario?: string | null;
  turno?: string | null;
  es_contratante?: boolean;
  descripcion?: string | null;
  activo?: boolean;
}

export interface TallerUpdate {
  nombre?: string | null;
  programa?: string | null;
  dia_semana?: string | null;
  horario?: string | null;
  turno?: string | null;
  es_contratante?: boolean | null;
  descripcion?: string | null;
  activo?: boolean | null;
}

// ── Annual weekly calendar configuration ─────────────────────────

export interface SemanaConfigOut {
  id: number | null;  // null if using default (no row in DB)
  anio: number;
  semana: number;
  tipo: "normal" | "intensiva";
  notas: string | null;
  extras_count: number;  // number of SemanaExtraSlot for this week
}

export interface SemanaConfigUpdate {
  tipo?: "normal" | "intensiva";
  notas?: string | null;
}

export interface SemanaExtraSlotOut {
  id: number;
  semana_config_id: number;
  taller_id: number;
  dia_semana: string | null;
  horario: string | null;
  notas: string | null;
  // Joined taller info
  taller_nombre: string;
  taller_programa: string;
}

export interface SemanaExtraSlotCreate {
  taller_id: number;
  dia_semana?: string | null;
  horario?: string | null;
  notas?: string | null;
}

export interface SemanaDetalleOut {
  semana: number;
  tipo: "normal" | "intensiva";
  notas: string | null;
  talleres: Array<{
    taller_id: number;
    nombre: string;
    programa: string;
    dia_semana: string | null;
    horario: string | null;
    turno: string | null;
    es_extra: boolean;
    extra_id: number | null;
    override?: boolean;
  }>;
  total_slots: number;
  total_ef: number;
  total_it: number;
  resumen: string;  // Human-readable summary
}

export interface CalendarioAnualResumen {
  anio: number;
  total_semanas: number;
  semanas_normales: number;
  semanas_intensivas: number;
  semanas_con_extras: number;
}

export interface BatchUpdateResult {
  updated: number;
  message: string;
}
