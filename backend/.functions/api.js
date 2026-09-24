const serverless = require('serverless-http');
const { app } = require('../src/app');

// El xlsx debe transmitirse como binario (base64) o serverless-http lo
// serializa como texto UTF-8 y el archivo se descarga dañado.
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

module.exports.handler = serverless(app, { binary: [XLSX_MIME] });