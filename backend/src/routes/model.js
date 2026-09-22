const express = require('express');
const service = require('../excel/service');
const F = require('../excel/fields');

const router = express.Router();

function cleanPerson(p) {
  const dia = (d) => {
    const base = {
      puestos: 0,
      estado: F.STATES.PENDIENTE,
      pagado: 0,
      asistencia: []
    };
    if (!d) return base;
    const puestos = Math.max(0, Math.round(Number(d.puestos) || 0));
    const asistencia = Array.isArray(d.asistencia) ? d.asistencia.slice(0, puestos) : [];
    while (asistencia.length < puestos) asistencia.push({ ida: false, venida: false });
    return {
      puestos,
      estado: F.STATES[d.estado] ? d.estado : F.STATES.PENDIENTE,
      pagado: Math.max(0, Math.round(Number(d.pagado) || 0)),
      asistencia
    };
  };
  return {
    nombre: String(p.nombre || '').trim(),
    dia1: dia(p.dia1),
    dia2: dia(p.dia2),
    dia3: dia(p.dia3),
    comentarios: p.comentarios ? String(p.comentarios) : ''
  };
}

function validate(model) {
  const errors = [];
  const config = model.config || {};
  const capacidad = Number(config.capacidadBus);
  const valor = Number(config.valorPuesto);
  if (!Number.isInteger(capacidad) || capacidad <= 0) errors.push('La capacidad del bus debe ser un entero mayor que 0.');
  if (!Number.isFinite(valor) || valor <= 0) errors.push('El valor del cupo debe ser un número mayor que 0.');

  const reservas = (model.reservas || []).map(cleanPerson);
  const totalesDia = { dia1: 0, dia2: 0, dia3: 0 };
  for (const p of reservas) {
    if (!p.nombre) errors.push('Cada reserva debe tener un nombre.');
    for (const key of ['dia1', 'dia2', 'dia3']) {
      if (p[key].estado !== F.STATES.CANCELADO) totalesDia[key] += p[key].puestos;
    }
  }
  for (const key of ['dia1', 'dia2', 'dia3']) {
    if (totalesDia[key] > capacidad) {
      errors.push(`${key.toUpperCase()}: ${totalesDia[key]} puestos solicitados, capacidad ${capacidad}.`);
    }
  }
  return { reservas, errors };
}

router.get('/', async (req, res) => {
  try {
    const model = await service.getModel();
    res.json(model);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/', async (req, res) => {
  try {
    const { reservas, errors } = validate(req.body || {});
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });
    const config = {
      eventoNombre: req.body.config.eventoNombre || F.DEFAULT_CONFIG.eventoNombre,
      capacidadBus: Number(req.body.config.capacidadBus),
      valorPuesto: Number(req.body.config.valorPuesto),
      fechaDia1: req.body.config.fechaDia1 || F.DEFAULT_CONFIG.fechaDia1,
      fechaDia2: req.body.config.fechaDia2 || F.DEFAULT_CONFIG.fechaDia2,
      fechaDia3: req.body.config.fechaDia3 || F.DEFAULT_CONFIG.fechaDia3
    };
    const result = await service.saveModel({ reservas, config, tareas: (req.body.tareas || []).filter((t) => String(t).trim() !== '') });
    res.json({ ok: true, sha: result.sha, totales: result.totales });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/reset', async (req, res) => {
  try {
    const eventNombre = (req.body && req.body.eventoNombre) || F.DEFAULT_CONFIG.eventoNombre;
    const emptyModel = {
      config: { ...F.DEFAULT_CONFIG, eventoNombre: eventNombre },
      reservas: [],
      tareas: []
    };
    const result = await service.saveModel(emptyModel);
    res.json({ ok: true, sha: result.sha });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/export', async (req, res) => {
  try {
    const buffer = await service.exportXlsx();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="ListadoBus.xlsx"');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;