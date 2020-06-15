const path = require('path');

const {
  fsReadFile,
} = require('./utils.js');

async function markdownFrontMatter(options, contents, file, group, config) {
  const mergeOption = options.merge;
  if (mergeOption === 'localFmRemoteBody') {
    // return local frontmatter with remote body
    const {
      local,
    } = file;
    const {
      rootDir,
    } = group;
    const localPath = path.join(rootDir, local);
    const localContents = await fsReadFile(localPath);
    const {
      fm: localFm,
    } = splitFmAndBody(localContents);
    const {
      body: remoteBody,
    } = splitFmAndBody(contents);
    return localFm + remoteBody;
  } else {
    throw new Error(`Unsupported merge option ${mergeOption}`);
  }
}

const fmDelimiter = '---';

function splitFmAndBody(contents) {
  const fileContent = contents.toString();
  const firstFmDelimiterPos = fileContent.indexOf(fmDelimiter);
  const secondFmDelimiterPos = fileContent.indexOf(fmDelimiter, fmDelimiter.length + 1);
  if (firstFmDelimiterPos !== 0 || secondFmDelimiterPos < 0) {
    // Does not define front matter, so just return file contents
    return {
      fm: '',
      body: fileContent,
    };
  }
  const fmEndPos = secondFmDelimiterPos + fmDelimiter.length + 1;
  const fm = fileContent.substring(firstFmDelimiterPos, fmEndPos);
  const body = fileContent.substring(fmEndPos);
  return {
    fm,
    body,
  };
}

module.exports = {
  markdownFrontMatter,
};