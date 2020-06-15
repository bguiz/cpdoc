const path = require('path');

const {
  fsWriteFile,
} = require('./utils.js');

const {
  httpGet,
} = require('./copiers.js');

const {
  markdownLinkFixer,
  markdownFrontMatter,
} = require('./post-processors.js');

async function cpdoc(config, configFileName) {
  const processGroupsPromises = config.groups.map((group) => (processGroup(group, config)));
  return Promise.all(processGroupsPromises);
}

async function processGroup(group, config) {
  const {
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
    rootDir,
    copier,
    postProcessors,
  } = group;

  let remoteFile;
  if (copier === 'httpGet') {
    remoteFile = await httpGet(remote);
  } else {
    throw new Error(`Unsupported copier ${copier}`);
  }

  let contents = remoteFile;
  let postProcessor;
  for (postProcessor of postProcessors) {
    const {
      id: postProcessorId,
      options: postProcessorOptions
    } = postProcessor;
    if (postProcessorId === 'markdownFrontMatter') {
      contents = await markdownFrontMatter(postProcessorOptions, contents, file, group, config);
    } else if (postProcessorId === 'markdownLinkFixer') {
      contents = await markdownLinkFixer(postProcessorOptions, contents, file, group, config);
    } else {
      throw new Error(`Unsupported post-processor ${postProcessorId}`);
    }
  }

  const localPath = path.join(rootDir, local);
  await fsWriteFile(localPath, contents);
}

module.exports = {
  cpdoc,
};
