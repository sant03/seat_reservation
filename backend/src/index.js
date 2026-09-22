const cfg = require('./config');
const { app } = require('./app');

app.listen(cfg.PORT, () => {
  console.log(`API escuchando en http://localhost:${cfg.PORT} (storage: ${cfg.STORAGE_TYPE})`);
});