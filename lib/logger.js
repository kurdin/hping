'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

module.exports = async function createLogger(logFile, homeDir) {
  let resolvedPath = logFile || 'logs/hping.log';
  if (!path.isAbsolute(resolvedPath)) {
    resolvedPath = path.resolve(homeDir, resolvedPath);
  }

  await fsp.mkdir(path.dirname(resolvedPath), { recursive: true });
  const stream = fs.createWriteStream(resolvedPath, { flags: 'a', encoding: 'utf8' });

  return {
    info(message) {
      const timestamp = new Date();
      const hh = String(timestamp.getHours()).padStart(2, '0');
      const mm = String(timestamp.getMinutes()).padStart(2, '0');
      const ss = String(timestamp.getSeconds()).padStart(2, '0');
      stream.write(`${hh}:${mm}:${ss} ${String(message)}\n`);
    },
    close() {
      return new Promise((resolve) => {
        stream.end(resolve);
      });
    }
  };
};
