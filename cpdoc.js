const path = require('path');

async function cpdoc(config, configFileName) {
  console.log(configFileName);
  const processGroupsPromises = config.groups.map((group) => (processGroup(group, config)));
  return Promise.all(processGroupsPromises);
}

async function processGroup(group, config) {
  const {
    id,
    rootDir,
    copyMethod,
    filters,
    postProcessors,
    files,
  } = group;

  const processFilesPromises = files.map((file) => (processFile(file, group, config)));
  return Promise.all(processFilesPromises);
}

async function processFile(file, group, config) {
  const {
    remote,
    local,
  } = file;
  const {
    id: groupId,
    rootDir,
  } = group;
  const {
    id: configId,
  } = config;
  const localPath = path.join(rootDir, local);
  console.log('processFile', configId, groupId, remote, localPath);
}

module.exports = {
  cpdoc,
};
