// V31 Capa 5 — tipos del import unificado de configuración (espejan
// app/schemas/config_import.py).

export interface CampoCambio {
  campo: string;
  antes: string;
  despues: string;
}

export interface PlanEmpresa {
  empresa_id: number | null;
  nombre: string;
  es_nueva: boolean;
  cambios: CampoCambio[];
}

export interface PlanError {
  fila_excel: number;
  empresa: string;
  tipo: string;
  mensaje: string;
  sugerencias: string[];
}

export interface PlanAviso {
  empresa: string;
  tipo: string;
  mensaje: string;
}

export interface PlanConfigResponse {
  trimestre: string;
  bloqueado: boolean;
  aplicado: boolean;
  resumen: string;
  por_empresa: PlanEmpresa[];
  errores: PlanError[];
  avisos: PlanAviso[];
}

// V32 — selector de trimestre (espeja settings.py TrimestresListResponse).
export type EstadoTrimestre =
  | "sin_planificar"
  | "planificado"
  | "en_operacion"
  | "cerrado";

export interface TrimestreEstado {
  trimestre: string;
  estado: EstadoTrimestre;
  total_slots: number;
  confirmados: number;
  cerrado: boolean;
  es_activo: boolean;
  es_siguiente: boolean;
  es_a_planificar: boolean;
}

export interface TrimestresListResponse {
  activo: string | null;
  siguiente: string | null;
  a_planificar: string | null;
  trimestres: TrimestreEstado[];
}

// V32 — config a simple vista (espeja ConfigVistaResponse de config_trimestral.py).
export interface ConfigFilaVista {
  empresa: string;
  activa: boolean;
  es_ep: boolean;
  tiene_reglas: boolean;
  sin_talleres: boolean;
  valores: Record<string, string | number>;
  grises: Record<string, string | number>;
}

export interface ConfigVistaResponse {
  trimestre: string;
  headers_editables: string[];
  headers_grises: string[];
  capacidad_ef: number;
  capacidad_it: number;
  total_ef_pedido: number;
  total_it_pedido: number;
  n_empresas: number;
  n_activas: number;
  n_ep: number;
  n_con_reglas: number;
  filas: ConfigFilaVista[];
}
