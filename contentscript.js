((browser) => {
  let fileHandles = [];
  let directoryHandles = [];

  const getDirectoryEntriesRecursive = async (
    directoryHandle,
    relativePath = '.',
  ) => {
    const entries = {};
    // Get an iterator for the files and folders in the directory.
    const iterator = directoryHandle.values();
    // Iterate through the files and folders.
    for await (const entry of iterator) {
      // If the entry is a file, add it to the entries object.
      const nestedPath = `${relativePath}/${entry.name}`;
      if (entry.kind === 'file') {
        entry.relativePath = nestedPath;
        fileHandles.push(entry);
        const file = await entry.getFile();
        entries[entry.name] = {
          kind: entry.kind,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
          relativePath: nestedPath,
        };
      }
      // If the entry is a directory, recursively get its entries and add them to the entries object.
      else if (entry.kind === 'directory') {
        entry.relativePath = nestedPath;
        directoryHandles.push(entry);
        entries[entry.name] = {
          kind: entry.kind,
          relativePath: nestedPath,
          entries: await getDirectoryEntriesRecursive(entry, nestedPath),
        };
      }
    }
    return entries;
  };

  const getFileHandle = (path) => {
    return fileHandles.find((element) => {
      return element.relativePath === path;
    });
  };

  const getDirectoryHandle = (path) => {
    return directoryHandles.find((element) => {
      return element.relativePath === path;
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
      const fileHandle = getFileHandle(request.data);
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
      const fileHandle = getFileHandle(request.data);
      try {
        await fileHandle.remove();
        sendResponse({ result: 'ok' });
      } catch (error) {
        console.error(error.name, error.message);
        sendResponse({ error: error.message });
      }
    } else if (request.message === 'deleteDirectory') {
      const directoryHandle = getDirectoryHandle(request.data);
      try {
        await directoryHandle.remove({ recursive: true });
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
