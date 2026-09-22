const { FilesystemStorage } = require('./filesystem');
const { GithubStorage } = require('./github');
const cfg = require('../config');

let instance = null;

function getStorage() {
  if (instance) return instance;
  if (cfg.STORAGE_TYPE === 'github') {
    if (!cfg.GITHUB.token || !cfg.GITHUB.owner || !cfg.GITHUB.repo) {
      throw new Error('Faltan variables GITHUB_TOKEN / GITHUB_OWNER / GITHUB_REPO para STORAGE_TYPE=github');
    }
    instance = new GithubStorage(cfg.GITHUB);
  } else {
    instance = new FilesystemStorage(cfg.FS_FILE_PATH);
  }
  return instance;
}

module.exports = { getStorage };