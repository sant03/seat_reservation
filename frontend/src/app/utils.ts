import { Config, DiaKey, DIA_KEYS, Reserva, Totales } from './models';

const VALOR_KEY = 'valorPuesto';
const CAP_KEY = 'capacidadBus';

export function stateLabel(estado: string): string {
  switch (estado) {
    case 'PAGADO': return 'Pagado';
    case 'ABONO': return 'Abono';
    case 'PENDIENTE': return 'Pendiente';
    case 'CANCELADO': return 'Cancelado';
    default: return 'Pendiente';
  }
}

export function chipClass(estado: string): string {
  return 'st-' + (estado || 'PENDIENTE').toLowerCase();
}

export function initials(nombre: string): string {
  const parts = (nombre || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_COLORS = ['#1e88e5', '#8e24aa', '#00897b', '#f4511e', '#3949ab', '#00838f', '#6d4c41', '#43a047'];

export function avatarColor(nombre: string): string {
  let hash = 0;
  const str = (nombre || '?');
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) % 997;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function deriveGlobalEstado(person: Reserva): string {
  const activos = DIA_KEYS
    .map((k) => person[k])
    .filter((d) => (d.puestos || 0) > 0 && d.estado !== 'CANCELADO');
  if (activos.length === 0) return 'CANCELADO';
  const estados = new Set(activos.map((d) => d.estado));
  if (estados.size === 1 && estados.has('PAGADO')) return 'PAGADO';
  if (estados.has('PENDIENTE')) return 'PENDIENTE';
  return 'ABONO';
}

export function computeTotales(reservas: Reserva[], config: Config): Totales {
  const capacidad = Number(config?.[CAP_KEY]) || 0;
  const valor = Number(config?.[VALOR_KEY]) || 0;
  const porDia = {} as Record<DiaKey, Totales['porDia'][DiaKey]>;
  for (const key of DIA_KEYS) {
    let puestos = 0;
    let pagado = 0;
    let conPuestos = 0;
    let cancelados = 0;
    for (const p of reservas) {
      const d = p[key];
      if (d.estado === 'CANCELADO') { cancelados++; continue; }
      const np = Math.max(0, Math.round(Number(d.puestos) || 0));
      if (np > 0) conPuestos++;
      puestos += np;
      pagado += Math.max(0, Math.round(Number(d.pagado) || 0));
    }
    const total = puestos * valor;
    const pendiente = Math.max(0, total - pagado);
    porDia[key] = {
      puestos,
      capacidad,
      disponibles: Math.max(0, capacidad - puestos),
      sobrecupo: puestos - capacidad,
      personasInscritas: conPuestos,
      cancelados,
      valor: total,
      pagado,
      pendiente
    };
  }
  const pagadoTotal = DIA_KEYS.reduce((s, k) => s + porDia[k].pagado, 0);
  const pendienteTotal = DIA_KEYS.reduce((s, k) => s + porDia[k].pendiente, 0);
  return {
    porDia,
    personas: reservas.length,
    cancelados: reservas.filter((p) => p.estadoGlobal === 'CANCELADO').length,
    pagadoTotal,
    pendienteTotal,
    recaudadoEsperado: pagadoTotal + pendienteTotal
  };
}

export function fmtMoney(n: number): string {
  if (n === null || n === undefined || isNaN(n)) return '$0';
  return '$' + Math.round(n).toLocaleString('es-CO');
}

export function fmtFecha(iso: string): string {
  if (!iso) return '-';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}