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

const getFileHandle = (path) => {
  return fileHandles.find((element) => {
    return element.relativePath === path;
  });
};

const asyncFunctionWithAwait = async (request, sender, sendResponse) => {
  if (request.message === 'getDirectoryStructure') {
    const root = await navigator.storage.getDirectory();
    structure = await getFiles(root, '.');
    sendResponse({ structure });
  } else if (request.message === 'downloadFile') {
    const fileHandle = getFileHandle(request.data);
    const handle = await showSaveFilePicker({
      suggestedName: fileHandle.name,
    });
    const writable = await handle.createWritable();
    await writable.write(await fileHandle.getFile());
    await writable.close();
  } else if (request.message === 'deleteFile') {
    const fileHandle = getFileHandle(request.data);
    try {
      await fileHandle.remove();
      sendResponse({ result: 'ok' });
    } catch (error) {
      sendResponse({ error: error.message });
    }
  }
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // https://stackoverflow.com/a/65405319/6255000
  asyncFunctionWithAwait(request, sender, sendResponse);
  return true;
});
