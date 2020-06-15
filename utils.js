const fs = require('fs');
const util = require('util');
const http = require('http');
const https = require('https');

const fsWriteFile = util.promisify(fs.writeFile);

const fsReadFile = util.promisify(fs.readFile);

module.exports = {
  fsWriteFile,
  fsReadFile,
};
