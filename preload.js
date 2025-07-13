const { contextBridge, ipcRenderer } = require("electron");
const os = require("os");
const path = require("path");

contextBridge.exposeInMainWorld("electronAPI", {
  selectOutputFolder: () => ipcRenderer.invoke("select-output-folder"),
  processFiles: (files, outputPath) =>
    ipcRenderer.invoke("process-files", files, outputPath),
  getDefaultDocumentsPath: () => path.join(os.homedir(), "Documents"),
});
