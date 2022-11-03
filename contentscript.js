  const getFiles = async (
    dirHandle,
    path = dirHandle.name
  ) => {
    const dirs = [];
    const files = [];
    for await (const entry of dirHandle.values()) {
      const nestedPath = path + '/' + entry.name;
      if (entry.kind === 'file') {
        files.push(
          entry.getFile().then((file) => {
            return {
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified,
            lastModifiedDate: file.lastModifiedDate,
            relativePath: nestedPath,
          }}))

      } else if (
        entry.kind === 'directory'
      ) {
        dirs.push(getFiles(entry, nestedPath));
      }
    }
    return [...(await Promise.all(dirs)).flat(), ...(await Promise.all(files))];
  };

  const asyncFunctionWithAwait = async (request, sender, sendResponse) => {
    console.log(request, sender)
    const structure = await getFiles(await navigator.storage.getDirectory(), '.');
    console.log(structure);
    sendResponse({structure});
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // https://stackoverflow.com/a/65405319/6255000
      asyncFunctionWithAwait(request, sender, sendResponse)
      return true
  })
