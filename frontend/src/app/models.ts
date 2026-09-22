export const ESTADOS = ['PAGADO', 'ABONO', 'PENDIENTE', 'CANCELADO'] as const;
export type Estado = (typeof ESTADOS)[number];

export const ESTADO_LABELS: Record<Estado, string> = {
  PAGADO: 'Pagado',
  ABONO: 'Abono',
  PENDIENTE: 'Pendiente',
  CANCELADO: 'Cancelado'
};

export const DIA_KEYS = ['dia1', 'dia2', 'dia3'] as const;
export type DiaKey = (typeof DIA_KEYS)[number];

export interface AsistenciaPuesto {
  ida: boolean;
  venida: boolean;
}

export interface DiaReserva {
  puestos: number;
  total: number;
  estado: Estado;
  pagado: number;
  pendiente: number;
  asistencia?: AsistenciaPuesto[];
}

export interface Reserva {
  id?: string;
  nombre: string;
  dia1: DiaReserva;
  dia2: DiaReserva;
  dia3: DiaReserva;
  total: number;
  estadoGlobal: Estado;
  valorPagado: number;
  valorPendiente: number;
  comentarios?: string;
}

export interface Config {
  eventoNombre: string;
  capacidadBus: number;
  valorPuesto: number;
  fechaDia1: string;
  fechaDia2: string;
  fechaDia3: string;
}

export interface TotalDia {
  puestos: number;
  capacidad: number;
  disponibles: number;
  sobrecupo: number;
  personasInscritas: number;
  cancelados: number;
  valor: number;
  pagado: number;
  pendiente: number;
}

export interface Totales {
  porDia: Record<DiaKey, TotalDia>;
  personas: number;
  cancelados: number;
  pagadoTotal: number;
  pendienteTotal: number;
  recaudadoEsperado: number;
}

export interface Model {
  config: Config;
  reservas: Reserva[];
  tareas: string[];
  totales: Totales;
}

export interface CommitInfo {
  sha: string;
  message: string;
  date: string;
  author: string;
}
