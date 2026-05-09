#!/usr/bin/env node
const path = require('path');
const fs = require('fs');

// Path to the compiled CLI index
const cliPath = path.join(__dirname, '../dist/cli/index.js');

if (!fs.existsSync(cliPath)) {
  console.error('Erro: CLI não compilado. Execute "npm run build" antes de usar a CLI.');
  process.exit(1);
}

require(cliPath);
