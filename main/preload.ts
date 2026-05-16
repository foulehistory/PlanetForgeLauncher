import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  login:       (data: unknown) => ipcRenderer.invoke("auth:login", data),
  register:    (data: unknown) => ipcRenderer.invoke("auth:register", data),
  getLibrary:  () => ipcRenderer.invoke("library:get"),
  installGame: (id: string)   => ipcRenderer.invoke("game:install", id),
});