const express = require('express');
const service = require('../excel/service');
const F = require('../excel/fields');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const model = await service.getModel();
    const totales = service.computeTotales(model.reservas, model.config);
    const porEstado = {
      PAGADO: 0,
      ABONO: 0,
      PENDIENTE: 0,
      CANCELADO: 0
    };
    for (const p of model.reservas) porEstado[p.estadoGlobal] = (porEstado[p.estadoGlobal] || 0) + 1;
    res.json({
      config: model.config,
      totales,
      porEstado,
      reservasPorDia: F.DAYS.map((d) => ({ dia: d.key, fecha: model.config[d.fechaKey] }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;