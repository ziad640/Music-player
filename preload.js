const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  openFolderDialog: () => ipcRenderer.invoke('open-folder-dialog'),
  parseAudioFiles: (filePaths) => ipcRenderer.invoke('parse-audio-files', filePaths),
  scanFolderForAudio: (folderPath) => ipcRenderer.invoke('scan-folder-for-audio', folderPath)
});