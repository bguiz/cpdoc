const path = require('path');

const {
  fsReadFile,
  doesFileExist,
  sanitiseAsId,
  parseUrlFileName,
} = require('./utils.js');
const {
  httpGetSaveFile,
} = require('./copiers.js');

const markdownHtmlStyleRegex =
  /\<style\>((?!\<\/style\>)(.|\n))*\<\/style\>/mg;

async function markdownHtmlStyleRemover(options, contents, file, group) {
  let updatedContents = contents;
  updatedContents = updatedContents.replace(markdownHtmlStyleRegex, '');
  return updatedContents;
}

const markDownFirstHeadingRegex =
  /(^#{1,6}\s+[^\s].*$\n+|^.*$\n^={1,}$\n+)/m;

async function markdownFirstHeadingRemover(options, contents, file, group) {
  let updatedContents = contents;
  updatedContents = updatedContents.replace(markDownFirstHeadingRegex, '');
  return updatedContents;
}

const markdownExternalImageRegex =
  /!\[([^\]]+)?\]\((https?\:\/\/[^)#]+)?(#[^\s)]*)?(\s+'[^']*'|\s+"[^"]*")?\)/gm;
const htmlExternalImageRegex =
  /<img[^>]+src="(https?\:\/\/[^"#]+)?(#[^\s)]*)?"(?:[^>]*)>/gm;

const markdownExternalImageReplacerDownloadModes =
  ['skip', 'always', 'default'];

function getExternalImageReplacement(
  imageDir, downloadMode, imageSubList, category, linkText, linkUrl, anchorId, text) {
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

  if (downloadMode !== 'skip') {
    imageSubList.push([linkUrl, substituteUrl]);
  }

  let replacement;
  if (category === '![]()') {
    replacement = `![${linkText}](/${substituteUrl}${endPart})`;
  } else if (category === '<img>') {
    replacement = `<img src="/${substituteUrl}${endPart}" alt="${linkText}" />`
  }
  return replacement;
}

async function markdownExternalImageReplacer(
  options, contents, file, group) {
  let {
    imageDir,
    downloadMode,
  } = options;
  if (markdownExternalImageReplacerDownloadModes.indexOf(downloadMode) < 0) {
    downloadMode = 'default';
  }

  const imageSubList = [];
  let updatedContents = contents;

  updatedContents = updatedContents.replace(
    markdownExternalImageRegex,
    (_match, linkText, linkUrl, anchorId, text) => {
      return getExternalImageReplacement(
        imageDir, downloadMode, imageSubList, '![]()', linkText, linkUrl, anchorId, text);
    },
  );

  updatedContents = updatedContents.replace(
    htmlExternalImageRegex,
    (match, linkUrl, anchorId) => {
      const altMatch = match.match(htmlAltPropertyRegex);
      const linkText = (altMatch && altMatch[1]) || '';
      return getExternalImageReplacement(
        imageDir, downloadMode, imageSubList, '<img>', linkText, linkUrl, anchorId, undefined);
    },
  );

  if (imageSubList.length > 0) {
    const imageDownloadPromises = [];
    const imageMap = new Map();

    for (imageSub of imageSubList) {
      const [
        linkUrl,
        substituteUrl,
      ] = imageSub;
      const prevSubstituteUrl = imageMap.get(linkUrl);
      if (!prevSubstituteUrl) {
        let fileExists = false;
        if (downloadMode !== 'always') {
          fileExists = await doesFileExist(substituteUrl);
        }
        if (!fileExists) {
          imageDownloadPromises.push(
            httpGetSaveFile(linkUrl, substituteUrl),
          );
        } else {
          // console.log(
          //   `The image file ${linkUrl
          //   } already exists at ${substituteUrl
          //   }. Not downloading again. Change 'downloadMode' to 'always' to override.`);
        }
        imageMap.set(linkUrl, substituteUrl);
      } else if (prevSubstituteUrl !== substituteUrl) {
        console.warn(
          `The image file ${linkUrl
          } has previously been downloaded as ${prevSubstituteUrl
          }, however is now also expected at ${substituteUrl
          }. Please rectify in source files.`);
      }
    }
    // console.log('Image files parsed count:', imageSubList.length);
    // console.log('Image file download count:', imageDownloadPromises.length);
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

const htmlImageRegex =
  /<img[^>]+src="([^"]+)"(?:[^>]*)>/gm;
const htmlAltPropertyRegex =
  /^.*alt="([^"]+)".*$/;

function getLinkReplacement(subsMap, category, linkText, linkUrl, anchorId, text) {
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
    if (typeof substituteUrl !== 'string') {
      // toggle trailing / and try again
      const linkWithToggledTrailingSlash = linkUrl.endsWith('/') ?
        linkUrl.slice(0, -1) :
        linkUrl + '/';
      substituteUrl = subsMap.get(linkWithToggledTrailingSlash);
    }
  }
  let replacement;
  if (typeof substituteUrl !== 'string') {
    substituteUrl = linkUrl;
  }
  if (category === '[]()') {
    replacement = `[${linkText}](${substituteUrl}${endPart})`;
  } else if (category === '<a>') {
    replacement = `<a href="${substituteUrl}${endPart}">${linkText}</a>`
  } else if (category === '<img>') {
    replacement = `<img src="${substituteUrl}${endPart}" alt="${linkText}" />`
  }
  return replacement;
}

async function markdownLinkFixer(options, contents, file, group) {
  const {
    substitutions = [],
  } = options;
  let updatedContents = contents;
  if (Array.isArray(substitutions)) {
    const subsMap = new Map();
    substitutions.forEach(([from, to]) => {
      subsMap.set(from, to);
    });

    updatedContents = updatedContents.replace(
      htmlLinkRegex,
      (_match, linkUrl, anchorId, linkText) => {
        return getLinkReplacement(subsMap, '<a>', linkText, linkUrl, anchorId, undefined);
      },
    );

    updatedContents = updatedContents.replace(
      htmlImageRegex,
      (match, linkUrl) => {
        const altMatch = match.match(htmlAltPropertyRegex);
        const linkText = (altMatch && altMatch[1]) || '';
        return getLinkReplacement(subsMap, '<img>', linkText, linkUrl, undefined, undefined);
      },
    );

    updatedContents = updatedContents.replace(
      markdownLinkRegex,
      (_match, linkText, linkUrl, anchorId, text) => {
        return getLinkReplacement(subsMap, '[]()', linkText, linkUrl, anchorId, text);
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
  markdownHtmlStyleRemover,
  markdownFirstHeadingRemover,
  markdownExternalImageReplacer,
  markdownLinkFixer,
  markdownFrontMatter,
};