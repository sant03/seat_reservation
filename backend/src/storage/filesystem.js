const fs = require('fs/promises');
const path = require('path');

// Almacenamiento local para desarrollo: lee/escribe el .xlsx en disco.
class FilesystemStorage {
  constructor(filePath) {
    this.filePath = filePath;
  }

  async read() {
    return fs.readFile(this.filePath);
  }

  async write(buffer) {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, buffer);
    return { sha: null, message: 'guardado local' };
  }

  async history() {
    // Sin historial en modo local.
    return [];
  }
}

module.exports = { FilesystemStorage };