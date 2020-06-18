const fs = require('fs');
const util = require('util');

const fsWriteFile = util.promisify(fs.writeFile);

const fsReadFile = util.promisify(fs.readFile);

function sanitiseAsId(str) {
  return str
    .trim()
    .toLowerCase()
    .replace(/\'/g, '')
    .replace(/[^#\-\w\d]/g, '-')
    .replace(/(\-{2,})/g, '-')
    .replace(/(^\-+|\-+$)/g, '');
}

function parseUrlFileName(url) {
  const posLastDot = url.lastIndexOf('.');
  const posLastSlash = url.lastIndexOf('/');
  const path = url.substring(0, posLastSlash);
  let fileName;
  let fileExt;
  if (posLastDot < posLastSlash) {
    fileName = url.substring(posLastSlash + 1);
    fileExt = '';
  } else {
    fileName = url.substring(posLastSlash + 1, posLastDot);
    fileExt = url.substring(posLastDot + 1);
  }
  return {
    path,
    fileName,
    fileExt,
  };
}

module.exports = {
  fsWriteFile,
  fsReadFile,
  sanitiseAsId,
  parseUrlFileName,
};
