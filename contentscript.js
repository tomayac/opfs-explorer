let fileHandles = [];

const getFiles = async (dirHandle, path = dirHandle.name) => {
  const dirs = [];
  const files = [];
  for await (const entry of dirHandle.values()) {
    const nestedPath = path + '/' + entry.name;
    if (entry.kind === 'file') {
      entry.relativePath = nestedPath;
      fileHandles.push(entry);
      files.push(
        entry.getFile().then((file) => {
          return {
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified,
            lastModifiedDate: file.lastModifiedDate,
            relativePath: nestedPath,
          };
        }),
      );
    } else if (entry.kind === 'directory') {
      dirs.push(getFiles(entry, nestedPath));
    }
  }
  return [...(await Promise.all(dirs)).flat(), ...(await Promise.all(files))];
};

const asyncFunctionWithAwait = async (request, sender, sendResponse) => {
  structure = await getFiles(await navigator.storage.getDirectory(), '.');
  sendResponse({ structure });
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === 'getDirectoryStructure') {
    // https://stackoverflow.com/a/65405319/6255000
    asyncFunctionWithAwait(request, sender, sendResponse);
  } else if (request.message === 'downloadFile') {
    const fileHandle = fileHandles.find((element) => {
      return element.relativePath === request.data;
    });
    fileHandle.getFile().then((file) => {
      const blobURL = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = blobURL;
      a.download = file.name;
      a.click();
    });
  }
  return true;
});
