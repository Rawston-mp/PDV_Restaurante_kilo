const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  testarImpressora: (config) => ipcRenderer.send('print-job:test', config),
  imprimirCupom: (dados) => ipcRenderer.send('print-job:execute', dados),
  listarImpressoras: () => ipcRenderer.invoke('print-job:list-printers')
});
