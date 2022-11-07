let confirmDialog;
let errorDialog;

let interval = null;

const readableSize = (size) => {
  if (size === 0) return '0B';
  const i = Math.floor(Math.log(size) / Math.log(1024));
  return `${(size / Math.pow(1024, i)).toFixed(2) * 1} ${
    ['B', 'kB', 'MB', 'GB', 'TB'][i]
  }`;
};

const createTreeHTML = (
  folder,
  structure,
  container,
  relativePath,
  isRoot = false,
) => {
  Object.keys(folder).forEach((key) => {
    if (Object.keys(folder[key]).length) {
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      summary.classList.add('folder');
      if (isRoot) {
        details.open = true;
        details.classList.add('root');
        summary.textContent = ' ';
      } else {
        summary.textContent = key;
      }
      details.append(summary);
      const div = document.createElement('div');
      details.append(div);
      container.append(details);
      createTreeHTML(
        folder[key],
        structure,
        div,
        key !== '.' ? relativePath + '/' + key : relativePath,
      );
    } else {
      const div = document.createElement('div');
      div.classList.add('file');
      div.tabIndex = 0;
      const filePath = relativePath + '/' + key;
      div.dataset.relativePath = filePath;
      const file = structure.find((element) => {
        return element.relativePath === filePath;
      });
      const fileNameSpan = document.createElement('span');
      fileNameSpan.textContent = key;
      fileNameSpan.addEventListener('click', (event) => {
        chrome.tabs.sendMessage(chrome.devtools.inspectedWindow.tabId, {
          message: 'downloadFile',
          data: filePath,
        });
      });
      const sizeSpan = document.createElement('span');
      sizeSpan.classList.add('size');
      sizeSpan.textContent = readableSize(file.size);
      const deleteSpan = document.createElement('span');
      deleteSpan.textContent = '🗑️';
      deleteSpan.classList.add('delete');
      deleteSpan.addEventListener('click', (event) => {
        confirmDialog.querySelector('code').textContent = key;
        confirmDialog.addEventListener(
          'close',
          (event) => {
            if (confirmDialog.returnValue === 'delete') {
              chrome.tabs.sendMessage(
                chrome.devtools.inspectedWindow.tabId,
                {
                  message: 'deleteFile',
                  data: filePath,
                },
                (response) => {
                  if (response.error) {
                    errorDialog.querySelector('p').textContent = response.error;
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
      div.append(fileNameSpan, sizeSpan, deleteSpan);
      container.append(div);
    }
  });
};

chrome.devtools.panels.create(
  'OPFS Explorer',
  'icon128.png',
  'panel.html',
  (panel) => {
    panel.onShown.addListener((extPanelWindow) => {
      confirmDialog =
        extPanelWindow.document.body.querySelector('.confirm-dialog');
      errorDialog = extPanelWindow.document.body.querySelector('.error-dialog');
      const main = extPanelWindow.document.body.querySelector('main');
      let lastLength = 0;

      const refreshTree = () => {
        chrome.tabs.sendMessage(
          chrome.devtools.inspectedWindow.tabId,
          { message: 'getDirectoryStructure' },
          (response) => {
            const newLength = JSON.stringify(response.structure).length;
            if (lastLength === newLength) {
              return;
            }
            lastLength = newLength;
            const structure = {};
            response.structure.forEach((file) => {
              file.relativePath
                .split('/')
                .reduce(
                  (previous, current) =>
                    (previous[current] = previous[current] || {}),
                  structure,
                );
            });
            const div = document.createElement('div');
            createTreeHTML(structure, response.structure, div, '.', true);
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

      refreshTree();
      interval = setInterval(refreshTree, 3000);
    });

    panel.onHidden.addListener(() => {
      clearInterval(interval);
    });
  },
);

// Create a connection to the background service worker.
const backgroundPageConnection = chrome.runtime.connect({
  name: 'devtools-page',
});

// Relay the tab ID to the background service worker.
backgroundPageConnection.postMessage({
  name: 'init',
  tabId: chrome.devtools.inspectedWindow.tabId,
});
