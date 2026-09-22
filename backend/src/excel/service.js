const ExcelJS = require('exceljs');
const { getStorage } = require('../storage');
const cfg = require('../config');
const F = require('./fields');

// ---------------------------------------------------------------- utilidades

function num(cell) {
  const v = cell && cell.value;
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '') return Number(v) || 0;
  if (v && typeof v === 'object') {
    const r = v.result;
    if (typeof r === 'number') return r;
    if (typeof r === 'string' && r.trim() !== '') return Number(r) || 0;
  }
  return 0;
}

function str(cell) {
  const v = cell && cell.value;
  if (v == null) return '';
  if (typeof v === 'object' && v.richText) {
    return v.richText.map((r) => r.text || '').join('');
  }
  return String(v).trim();
}

// El archivo original usa formulas compartidas de Excel para Mac que rompen
// la serializacion al insertar filas. Al cargar se convierten en valores
// cacheados; el calculo lo hace la app y el total se reescribe con SUM estandar.
function stripFormulas(workbook) {
  workbook.eachSheet((ws) => {
    ws.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell((cell) => {
        const v = cell.value;
        if (v && typeof v === 'object' &&
            (Object.prototype.hasOwnProperty.call(v, 'formula') ||
             Object.prototype.hasOwnProperty.call(v, 'sharedFormula'))) {
          cell.value = typeof v.result === 'number' ? v.result : 0;
        }
      });
    });
  });
}

function stateFromLabel(label) {
  const clean = (label || '').trim().toUpperCase();
  return F.LABEL_TO_STATE[clean] || F.STATES.PENDIENTE;
}

function encodeAsistencia(arr, puestos) {
  const parts = [];
  for (let i = 0; i < puestos; i++) {
    const a = (arr && arr[i]) || { ida: false, venida: false };
    parts.push(a.ida ? '1' : '0');
    parts.push(a.venida ? '1' : '0');
  }
  return parts.join(',');
}

function decodeAsistencia(raw, puestos) {
  const result = [];
  if (!raw || typeof raw !== 'string') {
    for (let i = 0; i < puestos; i++) result.push({ ida: false, venida: false });
    return result;
  }
  const parts = raw.split(',').map(s => s.trim());
  for (let i = 0; i < puestos; i++) {
    const idaVal = parts[i * 2] || '0';
    const venidaVal = parts[i * 2 + 1] || '0';
    result.push({ ida: idaVal === '1', venida: venidaVal === '1' });
  }
  return result;
}

// Deriva el estado global de una persona a partir de los estados por dia.
function deriveGlobalEstado(person) {
  const activos = F.DAYS.map((d) => person[d.key])
    .filter((dia) => (dia.puestos || 0) > 0 && dia.estado !== F.STATES.CANCELADO);
  if (activos.length === 0) return F.STATES.CANCELADO;
  const estados = new Set(activos.map((d) => d.estado));
  if (estados.size === 1 && estados.has(F.STATES.PAGADO)) return F.STATES.PAGADO;
  if (estados.has(F.STATES.PENDIENTE)) return F.STATES.PENDIENTE;
  return F.STATES.ABONO;
}

function col(ws, colLetter, row) {
  return ws.getCell(`${colLetter}${row}`);
}

// ---------------------------------------------------------------- layout

function findTotalRow(ws) {
  for (let r = F.FIRST_DATA_ROW; r <= ws.rowCount; r++) {
    if (str(col(ws, F.COLS.nombre, r)).toUpperCase() === 'TOTAL') return r;
  }
  return ws.rowCount + 1;
}

function findTareasLabelRow(ws, afterRow) {
  for (let r = afterRow; r <= ws.rowCount; r++) {
    // El label "TAREAS" esta en la columna U en el archivo original.
    const c = col(ws, 'U', r);
    if (str(c).toUpperCase().includes(F.TAREAS_LABEL)) return r;
  }
  return null;
}

// ---------------------------------------------------------------- lectura

function readConfig(workbook) {
  const config = { ...F.DEFAULT_CONFIG };
  const ws = workbook.getWorksheet(F.CONFIG_SHEET);
  if (ws) {
    for (const row of ws.getRows(1, ws.rowCount) || []) {
      const key = str(row.getCell(1));
      if (!key) continue;
      const raw = str(row.getCell(2));
      if (raw === '') continue;
      if (key === 'capacidadBus' || key === 'valorPuesto') config[key] = Number(raw);
      else config[key] = raw;
    }
  }
  return config;
}

function readPerson(ws, r, valorPuesto) {
  const nombre = str(col(ws, F.COLS.nombre, r));
  const dia = {};
  for (const d of F.DAYS) {
    const puestos = num(col(ws, d.cols.puestos, r));
    let estado = stateFromLabel(str(col(ws, d.cols.estado, r)));
    const pagado = num(col(ws, d.cols.pagado, r));
    if (F.LABEL_TO_STATE[str(col(ws, d.cols.estado, r)).trim().toUpperCase()] === undefined && puestos > 0) {
      const total = puestos * valorPuesto;
      if (pagado <= 0) estado = F.STATES.PENDIENTE;
      else if (pagado >= total) estado = F.STATES.PAGADO;
      else estado = F.STATES.ABONO;
    }
    const asistenciaCol = d.key === 'dia1' ? F.COLS.asistenciaDia1 :
                           d.key === 'dia2' ? F.COLS.asistenciaDia2 :
                           F.COLS.asistenciaDia3;
    const rawAsistencia = str(col(ws, asistenciaCol, r));
    const asistencia = decodeAsistencia(rawAsistencia, puestos);
    dia[d.key] = {
      puestos,
      total: puestos * valorPuesto,
      estado,
      pagado,
      pendiente: 0,
      asistencia
    };
  }
  const totalGlobal = num(col(ws, F.COLS.total, r));
  const valorPagado = num(col(ws, F.COLS.valorPagado, r));
  let estadoGlobal = stateFromLabel(str(col(ws, F.COLS.estadoGlobal, r)));
  if (F.LABEL_TO_STATE[str(col(ws, F.COLS.estadoGlobal, r)).trim().toUpperCase()] === undefined) {
    estadoGlobal = deriveGlobalEstado({ dia1: dia.dia1, dia2: dia.dia2, dia3: dia.dia3 });
  }
  // Recalcular pendiente por dia para mantener consistencia.
  for (const d of F.DAYS) {
    const t = dia[d.key];
    if (t.estado === F.STATES.CANCELADO) t.pendiente = 0;
    else if (t.estado === F.STATES.PENDIENTE) { t.pagado = 0; t.pendiente = t.total; }
    else t.pendiente = Math.max(0, t.total - t.pagado);
  }

  return {
    id: `res-${r}`,
    nombre,
    dia1: dia.dia1,
    dia2: dia.dia2,
    dia3: dia.dia3,
    total: totalGlobal || F.DAYS.reduce((s, d) => s + dia[d.key].total, 0),
    estadoGlobal,
    valorPagado,
    valorPendiente: Math.max(0, totalGlobal - valorPagado)
  };
}

function readReservas(ws, totalRow, config) {
  const reservas = [];
  for (let r = F.FIRST_DATA_ROW; r < totalRow; r++) {
    if (!str(col(ws, F.COLS.nombre, r))) continue;
    reservas.push(readPerson(ws, r, config.valorPuesto));
  }
  return reservas;
}

function readTareas(ws, totalRow) {
  const labelRow = findTareasLabelRow(ws, totalRow + 1) || F.DEFAULT_TAREAS_LABEL_ROW;
  const start = labelRow + 1;
  const tareas = [];
  for (let r = start; r <= ws.rowCount; r++) {
    const v = str(col(ws, F.COLS.nombre, r));
    if (!v && !col(ws, F.COLS.nombre, r).value && !col(ws, 'U', r).value) break;
    if (v && !v.toUpperCase().includes(F.TAREAS_LABEL)) tareas.push(v);
  }
  return { tareas, labelRow };
}

function computeTotales(reservas, config) {
  const capacidad = Number(config.capacidadBus)||0;
  const valorPuesto = Number(config.valorPuesto)||0;
  const porDia = {};
  for (const d of F.DAYS) {
    let puestos = 0, total = 0, pagado = 0, conPuestos = 0, cancelados = 0;
    for (const p of reservas) {
      const dia = p[d.key] || {};
      if (dia.estado === F.STATES.CANCELADO) { cancelados++; continue; }
      const np = Math.max(0, Math.round(Number(dia.puestos) || 0));
      if (np > 0) conPuestos++;
      puestos += np;
      total += np * valorPuesto;
      pagado += Math.max(0, Math.round(Number(dia.pagado) || 0));
    }
    const pendiente = Math.max(0, total - pagado);
    porDia[d.key] = {
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
  const personas = reservas.length;
  const cancelados = reservas.filter((p) => p.estadoGlobal === F.STATES.CANCELADO).length;
  const pagadoTotal = F.DAYS.reduce((s, d) => s + porDia[d.key].pagado, 0);
  const pendienteTotal = F.DAYS.reduce((s, d) => s + porDia[d.key].pendiente, 0);
  return {
    porDia,
    personas,
    cancelados,
    pagadoTotal,
    pendienteTotal,
    recaudadoEsperado: pagadoTotal + pendienteTotal
  };
}

async function readModelFromBuffer(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  stripFormulas(workbook);
  const config = readConfig(workbook);
  const ws = workbook.getWorksheet('Arreglo Bus');
  if (!ws) throw new Error('No se encontró la hoja "Arreglo Bus" en el archivo.');
  const totalRow = findTotalRow(ws);
  const reservas = readReservas(ws, totalRow, config);
  const { tareas } = readTareas(ws, totalRow);
  const totales = computeTotales(reservas, config);
  return { config, reservas, tareas, totales };
}

// ---------------------------------------------------------------- escritura

function writeConfig(workbook, config) {
  let ws = workbook.getWorksheet(F.CONFIG_SHEET);
  if (!ws) ws = workbook.addWorksheet(F.CONFIG_SHEET);
  ws.getCell('A1').value = 'CONFIGURACIÓN';
  ws.getCell('A1').font = { bold: true, size: 12 };
  F.CONFIG_KEYS.forEach((k, i) => {
    ws.getCell(`A${i + 2}`).value = k.key;
    ws.getCell(`B${i + 2}`).value = config[k.key] ?? F.DEFAULT_CONFIG[k.key];
  });
  ws.getColumn(1).width = 18;
  ws.getColumn(2).width = 22;
}

function clearPersonCells(ws, row) {
  col(ws, F.COLS.nombre, row).value = null;
  for (const d of F.DAYS) {
    col(ws, d.cols.puestos, row).value = null;
    col(ws, d.cols.total, row).value = null;
    col(ws, d.cols.estado, row).value = null;
    col(ws, d.cols.pagado, row).value = null;
    col(ws, d.cols.pendiente, row).value = null;
  }
  col(ws, F.COLS.total, row).value = null;
  col(ws, F.COLS.estadoGlobal, row).value = null;
  col(ws, F.COLS.valorPagado, row).value = null;
  col(ws, F.COLS.valorPendiente, row).value = null;
  col(ws, F.COLS.comentarios, row).value = null;
  col(ws, F.COLS.asistenciaDia1, row).value = null;
  col(ws, F.COLS.asistenciaDia2, row).value = null;
  col(ws, F.COLS.asistenciaDia3, row).value = null;
}

function copyRowStyle(ws, fromRow, toRow) {
  for (let c = 1; c <= 26; c++) {
    const src = ws.getCell(c, fromRow);
    const dst = ws.getCell(c, toRow);
    if (src && src.style) dst.style = JSON.parse(JSON.stringify(src.style));
  }
}

function writePerson(ws, row, person, valorPuesto) {
  col(ws, F.COLS.nombre, row).value = person.nombre;
  let totalGlobal = 0;
  let valorPagado = 0;
  for (const d of F.DAYS) {
    const data = person[d.key];
    const puestos = Math.max(0, Math.round(Number(data.puestos) || 0));
    const total = puestos * valorPuesto;
    let pagado = 0;
    let pendiente = 0;
    if (data.estado === F.STATES.PAGADO) { pagado = total; pendiente = 0; }
    else if (data.estado === F.STATES.PENDIENTE) { pagado = 0; pendiente = total; }
    else if (data.estado === F.STATES.ABONO) {
      pagado = Math.max(0, Math.min(total, Math.round(Number(data.pagado) || 0)));
      pendiente = total - pagado;
    }
    else { // CANCELADO
      pagado = Math.round(Number(data.pagado) || 0);
      pendiente = 0;
    }
    col(ws, d.cols.puestos, row).value = puestos;
    col(ws, d.cols.total, row).value = total;
    col(ws, d.cols.estado, row).value = F.STATE_TO_LABEL[data.estado] || F.STATE_TO_LABEL[F.STATES.PENDIENTE];
    col(ws, d.cols.pagado, row).value = pagado;
    col(ws, d.cols.pendiente, row).value = pendiente;
    const asistenciaCol = d.key === 'dia1' ? F.COLS.asistenciaDia1 :
                           d.key === 'dia2' ? F.COLS.asistenciaDia2 :
                           F.COLS.asistenciaDia3;
    col(ws, asistenciaCol, row).value = encodeAsistencia(data.asistencia, puestos);
    totalGlobal += total;
    valorPagado += pagado;
  }
  const estadoGlobal = deriveGlobalEstado(person);
  col(ws, F.COLS.total, row).value = totalGlobal;
  col(ws, F.COLS.estadoGlobal, row).value = F.STATE_TO_LABEL[estadoGlobal];
  col(ws, F.COLS.valorPagado, row).value = valorPagado;
  col(ws, F.COLS.valorPendiente, row).value = Math.max(0, totalGlobal - valorPagado);
  col(ws, F.COLS.comentarios, row).value = person.comentarios || null;
  return estadoGlobal;
}

function writeTotalsRow(ws, totalRow, reservas, valorPuesto) {
  const start = F.FIRST_DATA_ROW;
  const last = start + reservas.length - 1;
  if (last < start) return;
  const range = (cl) => `${cl}${start}:${cl}${last}`;
  const sumOf = (fn) => reservas.reduce((s, p) => s + (fn(p) || 0), 0);

  let totalGlobal = 0;
  let pagadoGlobal = 0;
  col(ws, F.COLS.nombre, totalRow).value = 'TOTAL';
  for (const d of F.DAYS) {
    const puestosSum = sumOf((p) => p[d.key]?.puestos || 0);
    const totSum = puestosSum * valorPuesto;
    const pagadoSum = sumOf((p) => p[d.key]?.pagado || 0);
    const pendSum = Math.max(0, totSum - pagadoSum);
    col(ws, d.cols.puestos, totalRow).value = { formula: `SUM(${range(d.cols.puestos)})`, result: puestosSum };
    col(ws, d.cols.total, totalRow).value = { formula: `SUM(${range(d.cols.total)})`, result: totSum };
    col(ws, d.cols.pagado, totalRow).value = { formula: `SUM(${range(d.cols.pagado)})`, result: pagadoSum };
    col(ws, d.cols.pendiente, totalRow).value = { formula: `SUM(${range(d.cols.pendiente)})`, result: pendSum };
    col(ws, d.cols.estado, totalRow).value = pendSum > 0 ? 'PENDIENTE' : 'PAGÓ';
    totalGlobal += totSum;
    pagadoGlobal += pagadoSum;
  }
  const pendGlobal = Math.max(0, totalGlobal - pagadoGlobal);
  col(ws, F.COLS.total, totalRow).value = { formula: `SUM(${range(F.COLS.total)})`, result: totalGlobal };
  col(ws, F.COLS.estadoGlobal, totalRow).value = pendGlobal > 0 ? 'PENDIENTE' : 'PAGÓ';
  col(ws, F.COLS.valorPagado, totalRow).value = { formula: `SUM(${range(F.COLS.valorPagado)})`, result: pagadoGlobal };
  col(ws, F.COLS.valorPendiente, totalRow).value = { formula: `SUM(${range(F.COLS.valorPendiente)})`, result: pendGlobal };
}

function writeTareas(ws, totalRow, tareas) {
  let labelRow = findTareasLabelRow(ws, totalRow + 1);
  if (labelRow == null) {
    // Crear sección TAREAS dos filas despues del total.
    labelRow = totalRow + 2;
    col(ws, 'U', labelRow).value = F.TAREAS_LABEL;
    col(ws, 'U', labelRow).font = { bold: true };
  }
  const start = labelRow + 1;
  // Limpiar entradas previas.
  const seen = [];
  for (let r = start; r <= ws.rowCount; r++) {
    const v = str(col(ws, F.COLS.nombre, r));
    if ((!v && !col(ws, F.COLS.nombre, r).value) && !col(ws, 'U', r).value) break;
    seen.push(r);
  }
  seen.forEach((r) => { col(ws, F.COLS.nombre, r).value = null; });
  (tareas || []).forEach((t, i) => {
    col(ws, F.COLS.nombre, start + i).value = t;
  });
}

function applyModelToWorkbook(workbook, model) {
  const ws = workbook.getWorksheet('Arreglo Bus');
  if (!ws) throw new Error('No se encontró la hoja "Arreglo Bus".');

  const valorPuesto = Number(model.config?.valorPuesto) || F.DEFAULT_CONFIG.valorPuesto;
  const reservas = (model.reservas || []).map((p) => ({
    ...p,
    dia1: p.dia1 || { puestos: 0, estado: F.STATES.PENDIENTE, pagado: 0, asistencia: [] },
    dia2: p.dia2 || { puestos: 0, estado: F.STATES.PENDIENTE, pagado: 0, asistencia: [] },
    dia3: p.dia3 || { puestos: 0, estado: F.STATES.PENDIENTE, pagado: 0, asistencia: [] }
  }));

  const oldTotalRow = findTotalRow(ws);
  const slots = oldTotalRow - F.FIRST_DATA_ROW;
  const needed = reservas.length;

  let totalRow = oldTotalRow;
  if (needed > slots) {
    const extra = needed - slots;
    for (let k = 0; k < extra; k++) {
      ws.insertRow(oldTotalRow + k, []);
      copyRowStyle(ws, F.FIRST_DATA_ROW, oldTotalRow + k);
    }
    totalRow = oldTotalRow + extra;
  }

  reservas.forEach((person, i) => {
    writePerson(ws, F.FIRST_DATA_ROW + i, person, valorPuesto);
  });
  // Limpiar filas sobrantes que quedan entre la ultima persona y el TOTAL.
  for (let r = F.FIRST_DATA_ROW + needed; r < totalRow; r++) {
    clearPersonCells(ws, r);
  }

  if (reservas.length > 0) {
    writeTotalsRow(ws, totalRow, reservas, valorPuesto);
  }

  writeTareas(ws, totalRow, model.tareas || []);
  writeConfig(workbook, model.config || {});

  workbook.calcProperties.fullCalcOnLoad = true;
  return workbook;
}

// ---------------------------------------------------------------- API de servicio

function buildEmptyWorkbook(model) {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet('Arreglo Bus');
  workbook.addWorksheet(F.CONFIG_SHEET);
  return applyModelToWorkbook(workbook, model);
}

// Cuando el storage remoto (github) aún no contiene el archivo, se siembra un
// modelo vacío en la primera lectura para que la app arranque utilizable.
async function loadOrSeedBuffer() {
  try {
    return await getStorage().read();
  } catch (err) {
    const isMissing = /no se encontro|not found/i.test(err.message || '');
    if (isMissing && cfg.STORAGE_TYPE === 'github') {
      const model = { config: { ...F.DEFAULT_CONFIG }, reservas: [], tareas: [] };
      const out = await buildEmptyWorkbook(model).xlsx.writeBuffer();
      await getStorage().write(Buffer.from(out));
      return Buffer.from(out);
    }
    throw err;
  }
}

async function getModel() {
  const buffer = await loadOrSeedBuffer();
  return readModelFromBuffer(buffer);
}

async function saveModel(model) {
  const buffer = await loadOrSeedBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  stripFormulas(workbook);
  applyModelToWorkbook(workbook, model);
  const out = await workbook.xlsx.writeBuffer();
  const result = await getStorage().write(Buffer.from(out));
  const totals = computeTotales(model.reservas || [], model.config || {});
  return { ...result, totales: totals };
}

async function exportXlsx() {
  const buffer = await loadOrSeedBuffer();
  return buffer;
}

async function getHistory() {
  return getStorage().history();
}

async function getModelAt(sha) {
  const buffer = await getStorage().readAt(sha);
  return readModelFromBuffer(buffer);
}

module.exports = {
  getModel,
  saveModel,
  exportXlsx,
  getHistory,
  getModelAt,
  computeTotales,
  STATES: F.STATES
};