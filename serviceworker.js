((browser) => {
  browser.runtime.onConnect.addListener((devToolsConnection) => {
    // Assign the listener function to a variable so we can remove it later.
    const devToolsListener = ({ tabId, name }, port) => {
      name === 'init' && port.postMessage(`Connected: ${tabId}`);
    }

    devToolsConnection.onMessage.addListener(devToolsListener);
    devToolsConnection.onDisconnect.addListener(() => {
      devToolsConnection.onMessage.removeListener(devToolsListener);
    });

    browser.tabs.onUpdated.addListener(() => {
      devToolsConnection.postMessage({ name: 'navigation' });
    });
  });
})(chrome || browser);
