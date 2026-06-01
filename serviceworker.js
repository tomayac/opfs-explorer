((browser) => {
  const tabPorts = new Map();

  browser.runtime.onConnect.addListener((devToolsConnection) => {
    devToolsConnection.onMessage.addListener(({ tabId, name }) => {
      if (name === 'init') {
        tabPorts.set(tabId, devToolsConnection);
      }
    });

    devToolsConnection.onDisconnect.addListener(() => {
      devToolsConnection.onMessage.removeListener(devToolsConnection);
      for (const [tabId, port] of tabPorts.entries()) {
        if (port === devToolsConnection) {
          tabPorts.delete(tabId);
          break;
        }
      }
    });

    browser.tabs.onUpdated.addListener(() => {
      devToolsConnection.postMessage({ name: 'navigation' });
    });
  });

  browser.runtime.onMessage.addListener((message, sender) => {
    if (message.name === 'fsChange' && sender.tab) {
      const port = tabPorts.get(sender.tab.id);
      if (port) {
        port.postMessage({ name: 'fsChange' });
      }
    }
  });
})(chrome || browser);
