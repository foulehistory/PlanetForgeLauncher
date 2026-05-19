import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  login:       (data: unknown) => ipcRenderer.invoke("auth:login", data),
  register:    (data: unknown) => ipcRenderer.invoke("auth:register", data),
  refresh:     (data: unknown) => ipcRenderer.invoke("auth:refresh", data),
  getLibrary:  () => ipcRenderer.invoke("library:get"),
  installGame: (id: string)   => ipcRenderer.invoke("game:install", id),
  isUpdateAvailable: () => ipcRenderer.invoke("update:check"),
  installUpdate: () => ipcRenderer.invoke("update:download-and-install"),
  onUpdateProgress: (cb: (percent: number) => void) => ipcRenderer.on("update:progress", (_e, percent) => cb(percent)),
});