const path = require('path');

const {
  fsReadFile,
  sanitiseAsId,
  parseUrlFileName,
} = require('./utils.js');
const {
  httpGetSaveFile,
} = require('./copiers.js');

const markDownFirstHeadingRegex =
  /(^#{1,6}\s+[^\s].*$\n+|^.*$\n^={1,}$\n+)/m;

async function markdownFirstHeadingRemover(options, contents, file, group) {
  let updatedContents = contents;
  updatedContents = updatedContents.replace(markDownFirstHeadingRegex, '');
  return updatedContents;
}

const markdownExternalImageRegex =
  /!\[([^\]]+)?\]\((https?\:\/\/[^)#]+)?(#[^\s)]*)?(\s+'[^']*'|\s+"[^"]*")?\)/gm;

async function markdownExternalImageReplacer(options, contents, file, group) {
  const {
    imageDir,
    skipDownloads,
  } = options;
  const imageDownloadPromises = [];
  let updatedContents = contents;
  updatedContents = updatedContents.replace(
    markdownExternalImageRegex,
    (_match, linkText, linkUrl, anchorId, text) => {
      // console.log(linkUrl);
      if (!linkText) {
        linkText = '';
      }
      let endPart = '';
      if (anchorId) {
        // sanitise the anchor ID
        endPart += sanitiseAsId(anchorId);
      }
      if (text) {
        endPart += text;
      }
      let imageFileName;
      let parsedImageUrl = parseUrlFileName(linkUrl);
      if (linkText) {
        imageFileName = sanitiseAsId(linkText);
      } else if (text) {
        imageFileName = sanitiseAsId(text);
      } else {
        imageFileName = parsedImageUrl.fileName;
      }
      const imageFileNameExt = `${imageFileName}.${parsedImageUrl.fileExt}`;
      const substituteUrl = path.join(imageDir, imageFileNameExt);
      // console.log(substituteUrl);
      if (!skipDownloads) {
        imageDownloadPromises.push(
          httpGetSaveFile(linkUrl, substituteUrl),
        );
      }
      const replacement = `![${linkText}](/${substituteUrl}${endPart})`;
      return replacement;
    },
  );
  if (!skipDownloads) {
    await Promise.all(imageDownloadPromises);
  }
  return updatedContents;
}

// NOTE that it is intentional that this matches on images too
// a leading `!` does not preclude a successful match
const markdownLinkRegex =
  /\[([^\]]+)\]\(([^)#]+)?(#[^\s)]*)?(\s+'[^']*'|\s+"[^"]*")?\)/gm;

const htmlLinkRegex =
/<a\s+[^>]*?href="([^"#]*)(#[^\s"]*)?"(?:\s+[^>]*)?>([^<]*)<\/a>/gm;

function getLinkReplacement(subsMap, linkText, linkUrl, anchorId, text) {
  let endPart = '';
  if (anchorId) {
    // sanitise the anchor ID
    endPart += sanitiseAsId(anchorId);
  }
  if (text) {
    endPart += text;
  }
  let substituteUrl;
  if (!linkUrl) {
    substituteUrl = '';
  } else {
    substituteUrl = subsMap.get(linkUrl);
    if (!substituteUrl) {
      // toggle trailing / and try again
      const linkWithToggledTrailingSlash = linkUrl.endsWith('/') ?
        linkUrl.slice(0, -1) :
        linkUrl + '/';
      substituteUrl = subsMap.get(linkWithToggledTrailingSlash);
    }
  }
  let replacement;
  if (typeof substituteUrl === 'string') {
    replacement = `[${linkText}](${substituteUrl}${endPart})`;
  } else {
    replacement = `[${linkText}](${linkUrl}${endPart})`;
  }
  return replacement;
}

async function markdownLinkFixer(options, contents, file, group) {
  const {
    substitutions,
  } = options;
  let updatedContents = contents;
  if (Array.isArray(substitutions) && substitutions.length > 0) {
    const subsMap = new Map();
    substitutions.forEach(([from, to]) => {
      subsMap.set(from, to);
    });

    updatedContents = updatedContents.replace(
      htmlLinkRegex,
      (_match, linkUrl, anchorId, linkText) => {
        return getLinkReplacement(subsMap, linkText, linkUrl, anchorId, undefined);
      },
    );

    updatedContents = updatedContents.replace(
      markdownLinkRegex,
      (_match, linkText, linkUrl, anchorId, text) => {
        return getLinkReplacement(subsMap, linkText, linkUrl, anchorId, text);
      },
    );
  }
  return updatedContents;
}

async function markdownFrontMatter(options, contents, file, group) {
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
  markdownFirstHeadingRemover,
  markdownExternalImageReplacer,
  markdownLinkFixer,
  markdownFrontMatter,
};