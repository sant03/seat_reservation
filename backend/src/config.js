require('dotenv').config();

const PORT = parseInt(process.env.PORT || '3000', 10);

// Storage: 'filesystem' (dev) o 'github' (produccion)
const STORAGE_TYPE = process.env.STORAGE_TYPE || 'filesystem';

const FS_FILE_PATH = process.env.FS_FILE_PATH || require('path').join(__dirname, '..', 'data', 'ListadoBus.xlsx');

const GITHUB = {
  token: process.env.GITHUB_TOKEN || '',
  owner: process.env.GITHUB_OWNER || '',
  repo: process.env.GITHUB_REPO || '',
  path: process.env.GITHUB_FILE_PATH || 'datos/ListadoBus.xlsx',
  branch: process.env.GITHUB_BRANCH || 'main',
  authorName: process.env.GITHUB_AUTHOR_NAME || 'Bus App',
  authorEmail: process.env.GITHUB_AUTHOR_EMAIL || 'busapp@example.com'
};

module.exports = { PORT, STORAGE_TYPE, FS_FILE_PATH, GITHUB };