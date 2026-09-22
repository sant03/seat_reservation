// Layout de la hoja "Arreglo Bus" del archivo Excel.
// Columna B: NOMBRE, luego bloques por dia y columnas globales (R..V).

const DAYS = [
  {
    key: 'dia1',
    name: 'DIA 1',
    fechaKey: 'fechaDia1',
    cols: { puestos: 'C', total: 'D', estado: 'E', pagado: 'F', pendiente: 'G' }
  },
  {
    key: 'dia2',
    name: 'DIA 2',
    fechaKey: 'fechaDia2',
    cols: { puestos: 'H', total: 'I', estado: 'J', pagado: 'K', pendiente: 'L' }
  },
  {
    key: 'dia3',
    name: 'DIA 3',
    fechaKey: 'fechaDia3',
    cols: { puestos: 'M', total: 'N', estado: 'O', pagado: 'P', pendiente: 'Q' }
  }
];

const COLS = {
  nombre: 'B',
  total: 'R',
  estadoGlobal: 'S',
  valorPagado: 'T',
  valorPendiente: 'U',
  comentarios: 'V',
  asistenciaDia1: 'W',
  asistenciaDia2: 'X',
  asistenciaDia3: 'Y'
};

const HEADER_ROW = 4;
const FIRST_DATA_ROW = 5;

// Estados canonicos de la app.
const STATES = {
  PAGADO: 'PAGADO',
  ABONO: 'ABONO',
  PENDIENTE: 'PENDIENTE',
  CANCELADO: 'CANCELADO'
};

// Mapeo estado canonico -> etiqueta escrita en el Excel.
const STATE_TO_LABEL = {
  PAGADO: 'PAGÓ',
  ABONO: 'ABONÓ',
  PENDIENTE: 'PENDIENTE',
  CANCELADO: 'CANCELADO'
};

// Mapeo etiqueta del Excel -> estado canonico.
const LABEL_TO_STATE = {
  'PAGÓ': 'PAGADO',
  'PAGO': 'PAGADO',
  'ABONÓ': 'ABONO',
  'ABONO': 'ABONO',
  'PENDIENTE': 'PENDIENTE',
  'CANCELADO': 'CANCELADO',
  'CANCELÓ': 'CANCELADO'
};

// Hoja de configuracion dentro del propio Excel.
const CONFIG_SHEET = 'Config';
const CONFIG_KEYS = [
  { key: 'eventoNombre', label: 'Nombre del evento' },
  { key: 'capacidadBus', label: 'Capacidad del bus (puestos por dia)' },
  { key: 'valorPuesto', label: 'Valor del cupo (ida y vuelta)' },
  { key: 'fechaDia1', label: 'Fecha dia 1 (AAAA-MM-DD)' },
  { key: 'fechaDia2', label: 'Fecha dia 2 (AAAA-MM-DD)' },
  { key: 'fechaDia3', label: 'Fecha dia 3 (AAAA-MM-DD)' }
];

const DEFAULT_CONFIG = {
  eventoNombre: 'Asamblea de Circuito',
  capacidadBus: 45,
  valorPuesto: 15000,
  fechaDia1: '2026-05-24',
  fechaDia2: '2026-05-25',
  fechaDia3: '2026-05-26'
};

const TAREAS_LABEL = 'TAREAS';

// Ubicaciones por defecto de la seccion TAREAS (se usan si no se detectan).
const DEFAULT_TAREAS_LABEL_ROW = 42;
const DEFAULT_TAREAS_START_ROW = 43;

module.exports = {
  DAYS,
  COLS,
  HEADER_ROW,
  FIRST_DATA_ROW,
  STATES,
  STATE_TO_LABEL,
  LABEL_TO_STATE,
  CONFIG_SHEET,
  CONFIG_KEYS,
  DEFAULT_CONFIG,
  TAREAS_LABEL,
  DEFAULT_TAREAS_LABEL_ROW,
  DEFAULT_TAREAS_START_ROW
};