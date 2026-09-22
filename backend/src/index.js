const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const cfg = require('./config');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, storage: cfg.STORAGE_TYPE });
});

app.use('/api/model', require('./routes/model'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/history', require('./routes/history'));

// Servir el frontend Angular si está compilado (mismo dominio que la API).
const DIST = path.join(__dirname, '..', '..', 'frontend', 'dist', 'frontend', 'browser');
if (fs.existsSync(path.join(DIST, 'index.html'))) {
  app.use(express.static(DIST));
  app.get('*', (req, res) => res.sendFile(path.join(DIST, 'index.html')));
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

app.listen(cfg.PORT, () => {
  console.log(`API escuchando en http://localhost:${cfg.PORT} (storage: ${cfg.STORAGE_TYPE})`);
});