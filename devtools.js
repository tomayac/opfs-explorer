((browser) => {
  let confirmDialog = null;
  let errorDialog = null;
  let editDialog = null;
  let main = null;
  let mainInnerHTML = '';
  const mainEmptyHTML = '<span>🫙</span> Origin Private File System is empty.';
  const openDirectories = new Set();

  let interval = null;

  let lastLength = 0;

  const readableSize = (size) => {
    if (size === 0) return '0B';
    const i = Math.floor(Math.log(size) / Math.log(1024));
    return `${(size / Math.pow(1024, i)).toFixed(2) * 1} ${
      ['B', 'KB', 'MB', 'GB', 'TB'][i]
    }`;
  };

  const createTreeHTML = (structure, container) => {
    const entries = Object.entries(structure);
    // Sort entries by name and kind.
    entries
      .sort((a, b) => {
        if (a[0] === b[0]) return 0;
        return a[0] < b[0] ? -1 : 1;
      })
      .sort((a, b) => {
        if (a[1].kind === b[1].kind) return 0;
        return a[1].kind < b[1].kind ? -1 : 1;
      });
    for (const [key, value] of entries) {
      if (value.kind === 'directory') {
        const details = document.createElement('details');
        container.append(details);
        const summary = document.createElement('summary');
        summary.classList.add('directory');
        details.append(summary);
        if (value.relativePath === '.') {
          details.open = true;
          details.classList.add('root');
          summary.textContent = '(Root)';

          const downloadButton = document.createElement('button');
          downloadButton.classList.add('text-button');
          downloadButton.textContent = '💾';
          downloadButton.title = 'Download All';
          downloadButton.classList.add('download');

          const deleteButton = document.createElement('button');
          deleteButton.classList.add('text-button');
          deleteButton.textContent = '🗑️';
          deleteButton.title = 'Delete All';
          deleteButton.classList.add('delete');

          if (Object.keys(value.entries).length === 0) {
            // Hide buttons if the Root directory is empty
            downloadButton.style.display = 'none';
            deleteButton.style.display = 'none';
          } else {
            // Add event listeners if the Root directory contains files or directories
            downloadButton.addEventListener('click', (event) => {
              browser.tabs.sendMessage(
                browser.devtools.inspectedWindow.tabId,
                {
                  message: 'downloadAll',
                },
                (response) => {
                  if (response.error) {
                    errorDialog.querySelector('p').textContent = response.error;
                    return errorDialog.showModal();
                  }
                },
              );
            });

            deleteButton.addEventListener('click', (event) => {
              confirmDialog.querySelector('code').textContent = '🏠 (Root)';
              const onConfirm = (event) => {
                confirmDialog.removeEventListener('close', onConfirm);
                if (confirmDialog.returnValue === 'delete') {
                  browser.tabs.sendMessage(
                    browser.devtools.inspectedWindow.tabId,
                    {
                      message: 'deleteRoot',
                    },
                    (response) => {
                      if (response.error) {
                        errorDialog.querySelector('p').textContent = response.error;
                        return errorDialog.showModal();
                      }
                      // Refresh the tree after deletion
                      refreshTree();
                    },
                  );
                }
              };
              confirmDialog.addEventListener('close', onConfirm);
              confirmDialog.showModal();
            });
          }

          summary.append(downloadButton, deleteButton);

        } else {
          details.open = openDirectories.has(value.relativePath);
          details.ontoggle = (event) => {
            if (details.open) {
              openDirectories.add(value.relativePath);
            } else {
              openDirectories.delete(value.relativePath);
            }
          };
          const directoryNameSpan = document.createElement('span');
          directoryNameSpan.classList.add('directory-name');
          directoryNameSpan.textContent = key;
          const downloadButton = document.createElement('button');
          downloadButton.classList.add('text-button');
          downloadButton.textContent = '💾';
          downloadButton.title = 'Download directory';
          downloadButton.classList.add('download');
          downloadButton.addEventListener('click', (event) => {
            browser.tabs.sendMessage(
              browser.devtools.inspectedWindow.tabId,
              {
                message: 'downloadDirectory',
                data: value.relativePath,
              },
              (response) => {
                if (response.error) {
                  errorDialog.querySelector('p').textContent = response.error;
                  return errorDialog.showModal();
                }
              },
            );
          });
          const deleteButton = document.createElement('button');
          deleteButton.classList.add('text-button');
          deleteButton.textContent = '🗑️';
          deleteButton.title = 'Delete directory';
          deleteButton.classList.add('delete');
          deleteButton.addEventListener('click', (event) => {
            confirmDialog.querySelector('span').textContent = 'directory';
            confirmDialog.querySelector('code').textContent = key;
            confirmDialog.addEventListener(
              'close',
              (event) => {
                if (confirmDialog.returnValue === 'delete') {
                  browser.tabs.sendMessage(
                    browser.devtools.inspectedWindow.tabId,
                    {
                      message: 'deleteDirectory',
                      data: value.relativePath,
                    },
                    (response) => {
                      if (response.error) {
                        errorDialog.querySelector('p').textContent =
                          response.error;
                        return errorDialog.showModal();
                      }
                      details.remove();
                    },
                  );
                }
              },
              { once: true },
            );
            confirmDialog.showModal();
          });
          summary.append(directoryNameSpan, downloadButton, deleteButton);
        }
        const div = document.createElement('div');
        details.append(div);
        createTreeHTML(value.entries, div);
      } else if (value.kind === 'file') {
        const div = document.createElement('div');
        div.classList.add('file');
        div.tabIndex = 0;
        div.title = `Type: ${
          value.type || 'Unknown'
        } - Last modified: ${new Date(value.lastModified).toLocaleString()}`;
        container.append(div);
        const fileNameButton = document.createElement('button');
        fileNameButton.classList.add('text-button');
        fileNameButton.classList.add('file-name');
        fileNameButton.textContent = key;
        fileNameButton.addEventListener('click', (event) => {
          browser.tabs.sendMessage(browser.devtools.inspectedWindow.tabId, {
            message: 'downloadFile',
            data: value,
          });
        });
        const sizeSpan = document.createElement('span');
        sizeSpan.classList.add('size');
        sizeSpan.textContent = readableSize(value.size);
        const editButton = document.createElement('button');
        editButton.classList.add('text-button');
        const type = value.type || '';

        editButton.textContent = '✏️';
        editButton.title = 'Edit file';
        editButton.classList.add('edit');
        editButton.addEventListener('click', (event) => {
          const textarea = editDialog.querySelector('textarea');
          textarea.value = '';
          browser.tabs.sendMessage(
            browser.devtools.inspectedWindow.tabId,
            {
              message: 'editFile',
              data: value.relativePath,
            },
            (response) => {
              if (response.error) {
                errorDialog.querySelector('p').textContent = response.error;
                return errorDialog.showModal();
              }
              textarea.value = response.result;
            },
          );
          editDialog.addEventListener(
            'close',
            (event) => {
              if (editDialog.returnValue === 'save') {
                browser.tabs.sendMessage(
                  browser.devtools.inspectedWindow.tabId,
                  {
                    message: 'writeFile',
                    data: value.relativePath,
                    content: textarea.value,
                  },
                  (response) => {
                    if (response.error) {
                      errorDialog.querySelector('p').textContent =
                        response.error;
                      return errorDialog.showModal();
                    }
                  },
                );
              }
            },
            { once: true },
          );
          editDialog.showModal();
        });

        const downloadButton = document.createElement('button');
        downloadButton.classList.add('text-button');
        downloadButton.textContent = '💾';
        downloadButton.title = 'Download file';
        downloadButton.classList.add('download');
        downloadButton.addEventListener('click', (event) => {
          browser.tabs.sendMessage(browser.devtools.inspectedWindow.tabId, {
            message: 'downloadFile',
            data: value,
          });
        });
        const deleteButton = document.createElement('button');
        deleteButton.classList.add('text-button');
        deleteButton.textContent = '🗑️';
        deleteButton.title = 'Delete file';
        deleteButton.classList.add('delete');
        deleteButton.addEventListener('click', (event) => {
          confirmDialog.querySelector('span').textContent = 'file';
          confirmDialog.querySelector('code').textContent = key;
          confirmDialog.addEventListener(
            'close',
            (event) => {
              if (confirmDialog.returnValue === 'delete') {
                browser.tabs.sendMessage(
                  browser.devtools.inspectedWindow.tabId,
                  {
                    message: 'deleteFile',
                    data: value.relativePath,
                  },
                  (response) => {
                    if (response.error) {
                      errorDialog.querySelector('p').textContent =
                        response.error;
                      return errorDialog.showModal();
                    }
                    div.remove();
                  },
                );
              }
            },
            { once: true },
          );
          confirmDialog.showModal();
        });
        div.append(
          fileNameButton,
          sizeSpan,
          editButton,
          downloadButton,
          deleteButton,
        );
      }
    }
  };

  const refreshTree = () => {
    browser.tabs.sendMessage(
      browser.devtools.inspectedWindow.tabId,
      { message: 'getDirectoryStructure' },
      (response) => {
        if (!response?.structure) {
          return;
        }
        // Naive check to avoid unnecessary DOM updates.
        const newLength = JSON.stringify(response.structure).length;
        if (lastLength === newLength) {
          return;
        }
        lastLength = newLength;
        if (Object.keys(response.structure).length === 0) {
          main.innerHTML = mainEmptyHTML;
          return;
        }
        const div = document.createElement('div');
        createTreeHTML(response.structure, div);
        if (!main) {
          return;
        }
        main.innerHTML = '';
        main.append(div);
        main.addEventListener('keydown', (event) => {
          if (event.target.nodeName === 'SUMMARY') {
            if (event.key === 'ArrowRight') {
              event.target.parentElement.open = true;
            } else if (event.key === 'ArrowLeft') {
              event.target.parentElement.open = false;
            }
          }
        });
      },
    );
  };

  browser.devtools.panels.create(
    'OPFS Explorer',
    'icon128.png',
    'panel.html',
    (panel) => {
      panel.onShown.addListener((extPanelWindow) => {
        confirmDialog =
          extPanelWindow.document.body.querySelector('.confirm-dialog');
        errorDialog =
          extPanelWindow.document.body.querySelector('.error-dialog');
        editDialog = extPanelWindow.document.body.querySelector('.edit-dialog');
        main = extPanelWindow.document.body.querySelector('main');
        if (!mainInnerHTML) {
          mainInnerHTML = main.innerHTML;
        }

        lastLength = 0;

        refreshTree();
        interval = setInterval(refreshTree, 3000);
      });

      panel.onHidden.addListener(() => {
        clearInterval(interval);
      });
    },
  );

  // Create a connection to the background service worker.
  const backgroundPageConnection = browser.runtime.connect({
    name: 'devtools-page',
  });

  // Relay the tab ID to the background service worker.
  backgroundPageConnection.postMessage({
    name: 'init',
    tabId: browser.devtools.inspectedWindow.tabId,
  });

  backgroundPageConnection.onMessage.addListener((message) => {
    if (message.name === 'navigation') {
      if (!main) {
        return;
      }
      lastLength = 0;
      main.innerHTML = mainInnerHTML;
      refreshTree();
    }
  });
})(chrome || browser);
