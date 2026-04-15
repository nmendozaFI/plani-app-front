/**
 * Types for Planificado vs Realizado analysis.
 * Tracks traceability between solver assignments and actual execution.
 */

export interface EmpresaAnalisis {
  empresa_id: number;
  empresa_nombre: string;
  asignados_solver: number;  // Slots assigned by solver
  cumplidos: number;         // Slots ended with this company (OK/CONFIRMADO)
  sustituida: number;        // Slots where company was replaced
  cancelados: number;        // Slots that were CANCELADO
  pendientes: number;        // Slots still PLANIFICADO/CONFIRMADO
  extras_cubiertos: number;  // Slots where company stepped in as substitute
  tasa_cumplimiento: number; // % of assigned slots fulfilled
  tasa_sustitucion: number;  // % of assigned slots substituted
  sugerencia: "REDUCIR" | "REVISAR" | "MANTENER" | "SOLO_COMODIN";
}

export interface CambioSlot {
  semana: number;
  dia: string;
  taller: string;
  programa: string;
  empresa_original: string;
  empresa_final: string;
}

export interface AnalisisResumen {
  total_slots_asignados: number;
  cumplidos_sin_cambio: number;
  sustituidos: number;
  cancelados: number;
  pendientes: number;
  tasa_cumplimiento_global: number;
  tasa_sustitucion_global: number;
}

export interface AnalisisResponse {
  trimestre: string;
  resumen: AnalisisResumen;
  por_empresa: EmpresaAnalisis[];
  cambios: CambioSlot[];
  total_empresas: number;
}
