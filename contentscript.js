((browser) => {
  let fileHandles = [];
  let directoryHandles = [];

  const textDecoder = new TextDecoder();

  // From SQLites/WASM
  const SECTOR_SIZE = 4096;
  const HEADER_MAX_PATH_SIZE = 512;
  const HEADER_FLAGS_SIZE = 4;
  const HEADER_DIGEST_SIZE = 8;
  const HEADER_CORPUS_SIZE = HEADER_MAX_PATH_SIZE + HEADER_FLAGS_SIZE;
  const HEADER_OFFSET_DIGEST = HEADER_CORPUS_SIZE;
  const HEADER_OFFSET_DATA = SECTOR_SIZE;

  // From SQLites/WASM
  const computeSAHFileDigest = (byteArray) => {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (const v of byteArray) {
      h1 = 31 * h1 + v * 307;
      h2 = 31 * h2 + v * 307;
    }
    return new Uint32Array([h1 >>> 0, h2 >>> 0]);
  };

  /**
   * Decodes the SAH-pool filename from the given file.
   * @returns the filename if successfully decoded, `unassociated!` if decoded but the file doesn't have an associated
   *  filename, or `undefined` if the file is not a valid SAH-pool file.
   */

  const decodeSAHPoolFilename = async (file) => {
    const apBody = new Uint8Array(
      await file.slice(0, HEADER_CORPUS_SIZE).arrayBuffer(),
    );
    const fileDigest = new Uint32Array(
      await file
        .slice(HEADER_OFFSET_DIGEST, HEADER_OFFSET_DIGEST + HEADER_DIGEST_SIZE)
        .arrayBuffer(),
    );
    const compDigest = computeSAHFileDigest(apBody);
    if (fileDigest.every((v, i) => v === compDigest[i])) {
      // Valid digest
      const pathBytes = apBody.findIndex((v) => 0 === v);
      if (pathBytes <= 0) {
        return `unassociated!`;
      } else {
        return textDecoder.decode(apBody.subarray(0, pathBytes));
      }
    }
  };

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
          handle.getFile().then(async (file) => {
            // Try to decode the SAH-pool filename only if the file is in the .opaque directory
            const sahPoolName =
              directoryHandle.name === '.opaque'
                ? await decodeSAHPoolFilename(file).catch(() => {})
                : undefined;
            const displayName = sahPoolName
              ? `SAH-pool VFS entry: ${sahPoolName} (OPFS name: ${handle.name})`
              : handle.name;
            return {
              name: displayName,
              kind: handle.kind,
              size: file.size,
              type: file.type,
              lastModified: file.lastModified,
              relativePath: nestedPath,
              isSAHPool: !!sahPoolName,
              originalFilename: sahPoolName
                ? sahPoolName.split('/').at(-1)
                : handle.name,
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

  const downloadDirectoryEntriesRecursive = async (
    directoryHandle,
    relativePath = '.',
    download = null,
  ) => {
    // Get an iterator of the files and folders in the directory.
    const directoryIterator = directoryHandle.values();
    const directoryEntryPromises = [];
    for await (const handle of directoryIterator) {
      const nestedPath = `${relativePath}/${handle.name}`;
      if (handle.kind === 'file') {
        const fileHandle = getFileHandle(nestedPath).handle;
        try {
          const sahPoolName =
            directoryHandle.name === '.opaque'
              ? await decodeSAHPoolFilename(file).catch(() => {})
              : undefined;
          const displayName = sahPoolName
            ? `SAH-pool VFS entry: ${sahPoolName} (OPFS name: ${handle.name})`
            : handle.name;
          const handleDisk = await download.getFileHandle(displayName, {
            create: true,
          });
          const fileData = await fileHandle.getFile();
          const dataToSave = sahPoolName
            ? fileData.slice(HEADER_OFFSET_DATA)
            : fileData;
          const writable = await handleDisk.createWritable();
          await writable.write(dataToSave);
          await writable.close();
        } catch (error) {
          if (error.name !== 'AbortError') {
            console.error(error.name, error.message);
          }
        }
      } else if (handle.kind === 'directory') {
        directoryEntryPromises.push(
          (async () => {
            return {
              name: handle.name,
              kind: handle.kind,
              relativePath: nestedPath,
              entries: await downloadDirectoryEntriesRecursive(
                handle,
                nestedPath,
                await download.getDirectoryHandle(handle.name, {
                  create: true,
                }),
              ),
            };
          })(),
        );
      }
    }
    await Promise.all(directoryEntryPromises);
    return 'success';
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
      const fileHandle = getFileHandle(request.data.relativePath).handle;
      try {
        const handle = await showSaveFilePicker({
          suggestedName: request.data.originalFilename,
        });
        const fileData = await fileHandle.getFile();
        const dataToSave = request.data.isSAHPool
          ? fileData.slice(HEADER_OFFSET_DATA)
          : fileData;
        const writable = await handle.createWritable();
        await writable.write(dataToSave);
        await writable.close();
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error(error.name, error.message);
        }
      }
    } else if (request.message === 'editFile') {
      const fileHandle = getFileHandle(request.data).handle;
      try {
        const contents = await (await fileHandle.getFile()).text();
        sendResponse({ result: contents });
      } catch (error) {
        console.error(error.name, error.message);
        sendResponse({ error: error.message });
      }
    } else if (request.message === 'writeFile') {
      const fileHandle = getFileHandle(request.data).handle;
      try {
        const writable = await fileHandle.createWritable();
        await writable.write(request.content);
        await writable.close();
        sendResponse({ result: 'ok' });
      } catch (error) {
        console.error(error.name, error.message);
        sendResponse({ error: error.message });
      }
    } else if (request.message === 'deleteFile') {
      const fileHandle = getFileHandle(request.data).handle;
      try {
        await fileHandle.remove();
        sendResponse({ result: 'ok' });
      } catch (error) {
        console.error(error.name, error.message);
        sendResponse({ error: error.message });
      }
    } else if (request.message === 'deleteDirectory') {
      const directoryHandle = getDirectoryHandle(request.data).handle;
      try {
        await directoryHandle.remove({ recursive: true });
        sendResponse({ result: 'ok' });
      } catch (error) {
        console.error(error.name, error.message);
        sendResponse({ error: error.message });
      }
    } else if (request.message === 'downloadAll') {
      try {
        const download = await showDirectoryPicker({
          mode: 'readwrite',
          startIn: 'downloads',
        });
        const root = await navigator.storage.getDirectory();
        await downloadDirectoryEntriesRecursive(root, '.', download);
        sendResponse({ result: 'success' });
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error(error.name, error.message);
          sendResponse({ error: error.message });
        } else {
          sendResponse({ result: 'success' });
        }
      }
    }
  };

  browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // https://stackoverflow.com/a/65405319/6255000
    asyncFunctionWithAwait(request, sender, sendResponse);
    return true;
  });
})(chrome || browser);
