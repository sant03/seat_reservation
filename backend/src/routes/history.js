const express = require('express');
const service = require('../excel/service');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const commits = await service.getHistory();
    res.json(commits);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:sha', async (req, res) => {
  try {
    const model = await service.getModelAt(req.params.sha);
    res.json(model);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

module.exports = router;