#!/usr/bin/env node

const {
  fsReadFile,
} = require('./utils.js');
const {
  cpdoc,
} = require('./cpdoc.js');

async function runCpdocFromCli() {
  const args  = process.argv.slice(2);
  const configFileName = args[0] || '.cpdoc.config.json';
  process.stdout.write(`Parsing config from: ${configFileName}\n`);
  const configBuffer = await fsReadFile(configFileName);
  const config = JSON.parse(configBuffer);
  await cpdoc(config, configFileName);
}

runCpdocFromCli();
