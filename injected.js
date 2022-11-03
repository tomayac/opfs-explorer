(async () => {
  const getFiles = async (
    dirHandle,
    recursive,
    path = dirHandle.name,
    skipDirectory
  ) => {
    const dirs = [];
    const files = [];
    for await (const entry of dirHandle.values()) {
      const nestedPath = path + '/' + entry.name;
      if (entry.kind === 'file') {
        files.push(
          entry.getFile().then((file) => {
            file.directoryHandle = dirHandle;
            file.handle = entry;
            return Object.defineProperty(file, 'webkitRelativePath', {
              configurable: true,
              enumerable: true,
              get: () => nestedPath,
            });
          })
        );
      } else if (
        entry.kind === 'directory' &&
        recursive &&
        (!skipDirectory || !skipDirectory(entry))
      ) {
        dirs.push(getFiles(entry, recursive, nestedPath, skipDirectory));
      }
    }
    return [...(await Promise.all(dirs)).flat(), ...(await Promise.all(files))];
  };

  /**
   * Opens a directory from disk using the File System Access API.
   * @type { typeof import("../index").directoryOpen }
   */
  const list = async (options = {}) => {
    options.recursive = options.recursive || true;
    options.mode = options.mode || 'read';
    const handle = await navigator.storage.getDirectory();
    return getFiles(handle, options.recursive, undefined, options.skipDirectory);
  };

  return await list();
})()
