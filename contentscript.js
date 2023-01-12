((browser) => {
  let fileHandles = [];
  let directoryHandles = [];

  const getDirectoryEntriesRecursive = async (
    directoryHandle,
    relativePath = '.',
  ) => {
    const entries = {};
    // Get an iterator of the files and folders in the directory.
    const directoryIterator = directoryHandle.values();
    const directoryEntryPromises = [];
    for await (const handle of directoryIterator) {
      const nestedPath = `${relativePath}/${handle.name}`;
      if (handle.kind === 'file') {
        fileHandles.push({ handle, nestedPath });
        directoryEntryPromises.push(
          handle.getFile().then((file) => {
            return {
              name: handle.name,
              kind: handle.kind,
              size: file.size,
              type: file.type,
              lastModified: file.lastModified,
              relativePath: nestedPath,
            };
          }),
        );
      } else if (handle.kind === 'directory') {
        directoryHandles.push({ handle, nestedPath });
        directoryEntryPromises.push(
          (async () => {
            return {
              name: handle.name,
              kind: handle.kind,
              relativePath: nestedPath,
              entries: await getDirectoryEntriesRecursive(handle, nestedPath),
            };
          })(),
        );
      }
    }
    const directoryEntries = await Promise.all(directoryEntryPromises);
    directoryEntries.forEach((directoryEntry) => {
      entries[directoryEntry.name] = directoryEntry;
    });
    return entries;
  };

  const getFileHandle = (path) => {
    return fileHandles.find((element) => {
      return element.nestedPath === path;
    });
  };

  const getDirectoryHandle = (path) => {
    return directoryHandles.find((element) => {
      return element.nestedPath === path;
    });
  };

  const asyncFunctionWithAwait = async (request, sender, sendResponse) => {
    if (request.message === 'getDirectoryStructure') {
      fileHandles = [];
      directoryHandles = [];
      const root = await navigator.storage.getDirectory();
      const structure = await getDirectoryEntriesRecursive(root);
      const rootStructure = {
        '.': {
          kind: 'directory',
          relativePath: '.',
          entries: structure,
        },
      };
      sendResponse({ structure: rootStructure });
    } else if (request.message === 'saveFile') {
      const fileHandle = getFileHandle(request.data).handle;
      try {
        const handle = await showSaveFilePicker({
          suggestedName: fileHandle.name,
        });
        const writable = await handle.createWritable();
        await writable.write(await fileHandle.getFile());
        await writable.close();
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error(error.name, error.message);
        }
      }
    } else if (request.message === 'deleteFile') {
      const filename = request.data.split('/').reverse()[0];
      const directory = request.data.substring(0, request.data.lastIndexOf("/"));
      const directoryHandle = getDirectoryHandle(directory).handle;
      try {
        await directoryHandle.removeEntry(filename);
        sendResponse({ result: 'ok' });
      } catch (error) {
        console.error(error.name, error.message);
        sendResponse({ error: error.message });
      }
    } else if (request.message === 'deleteDirectory') {
      const filename = request.data.split('/').reverse()[0];
      const directory = request.data.substring(0, request.data.lastIndexOf("/"));
      let directoryHandle = null;
      if(directory == ".") {
        directoryHandle = await navigator.storage.getDirectory();
      } else {
        directoryHandle = await getDirectoryHandle(directory).handle;
      }
      try {
        await directoryHandle.removeEntry(filename, { recursive: true });
        sendResponse({ result: 'ok' });
      } catch (error) {
        console.error(error.name, error.message);
        sendResponse({ error: error.message });
      }
    }
  };

  browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // https://stackoverflow.com/a/65405319/6255000
    asyncFunctionWithAwait(request, sender, sendResponse);
    return true;
  });
})(chrome || browser);
