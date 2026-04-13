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
