const connections = {};

chrome.runtime.onConnect.addListener((devToolsConnection) => {
  // Assign the listener function to a variable so we can remove it later.
  let devToolsListener = (message) => {
    if (message.name === 'init') {
      const id = message.tabId;
      connections[id] = devToolsConnection;
      // Send a message back to DevTools.
      connections[id].postMessage('Connected!');
    }
  };

  // Listen to messages sent from the DevTools page.
  devToolsConnection.onMessage.addListener(devToolsListener);

  devToolsConnection.onDisconnect.addListener(() => {
    devToolsConnection.onMessage.removeListener(devToolsListener);
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  devToolsConnection.postMessage({
    name: 'navigation',
  });
});
