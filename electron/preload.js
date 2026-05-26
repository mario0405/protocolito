const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('protocolito', {
  invoke(command, args) {
    return ipcRenderer.invoke('protocolito:invoke', command, args || {});
  },

  listen(eventName, callback) {
    const handler = (_event, message) => {
      if (message.event === eventName) {
        callback({ event: message.event, payload: message.payload });
      }
    };

    ipcRenderer.on('protocolito:event', handler);
    return Promise.resolve(() => {
      ipcRenderer.removeListener('protocolito:event', handler);
    });
  },

  emit(event, payload) {
    ipcRenderer.send('protocolito:emit', { event, payload });
    return Promise.resolve();
  },

  getVersion() {
    return ipcRenderer.invoke('protocolito:invoke', 'app_get_version', {});
  },

  appDataDir() {
    return ipcRenderer.invoke('protocolito:invoke', 'app_data_dir', {});
  },

  platform() {
    return ipcRenderer.invoke('protocolito:invoke', 'platform', {});
  },
});
