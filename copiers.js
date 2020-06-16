const fs = require('fs');
const http = require('http');
const https = require('https');

function getHttpOrHttps(url) {
  const protocol = url.split('://')[0];
  let httpOrHttps;
  if (protocol === 'http') {
    httpOrHttps = http;
  } else if (protocol === 'https') {
    httpOrHttps = https;
  } else {
    return reject(new Error(`Unsupported protocol ${protocol}`));
  }
  return httpOrHttps;
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    httpOrHttps = getHttpOrHttps(url);

    httpOrHttps.get(url, (res) => {
      const { statusCode } = res;

      let error;
      if (statusCode !== 200) {
        error = reject(new Error(`Status code ${statusCode} for ${url}`));
      }
      if (error) {
        console.error(error.message);
        // Consume response data to free up memory
        res.resume();
        return reject(error);
      }

      res.setEncoding('utf8');
      let rawData = '';
      res.on('data', (chunk) => { rawData += chunk; });
      res.on('end', () => {
        return resolve(rawData);
      });
    }).on('error', (e) => {
      return reject(e);
    });
  });
}

function httpGetSaveFile(url, fileName) {
  return new Promise((resolve, reject) => {
    httpOrHttps = getHttpOrHttps(url);
    const file = fs.createWriteStream(fileName);
    httpOrHttps.get(url, (response) => {
      response.pipe(file);
      file.on('finish', function() {
        file.close((err) => {
          if (err) {
            return reject(err);
          }
          resolve();
        });
      });
    }).on('error', (err) => {
      fs.unlink(fileName);
      reject(err);
    });
  });
}

module.exports = {
  httpGet,
  httpGetSaveFile,
};
