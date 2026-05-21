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
  showNotification: (title: string, body: string) => ipcRenderer.send("notify:show", { title, body }),
  getScreenSources: () => ipcRenderer.invoke("get-screen-sources"),

  // ── Overlay: main window → overlay (via main process) ─────────────────────
  overlayShowCall:    (data: unknown) => ipcRenderer.send("overlay:show-call", data),
  overlayHideCall:    () => ipcRenderer.send("overlay:hide-call"),
  overlayShowNotif:   (data: unknown) => ipcRenderer.send("overlay:show-notif", data),
  overlayRemoveNotif: (id: string)    => ipcRenderer.send("overlay:remove-notif", id),

  // Main window listens for overlay button clicks
  onOverlayCallAccepted: (cb: () => void) => ipcRenderer.on("overlay:call-accepted", cb),
  onOverlayCallDeclined: (cb: () => void) => ipcRenderer.on("overlay:call-declined", cb),

  // ── Overlay: receives forwarded events from main process ──────────────────
  onOverlayShowCall:    (cb: (data: unknown) => void) => ipcRenderer.on("overlay:show-call-fwd",    (_e, d) => cb(d)),
  onOverlayHideCall:    (cb: () => void)              => ipcRenderer.on("overlay:hide-call-fwd",    () => cb()),
  onOverlayShowNotif:   (cb: (data: unknown) => void) => ipcRenderer.on("overlay:show-notif-fwd",   (_e, d) => cb(d)),
  onOverlayRemoveNotif: (cb: (id: string) => void)    => ipcRenderer.on("overlay:remove-notif-fwd", (_e, id) => cb(id as string)),

  // Overlay sends button clicks back (relayed to main window)
  overlayAcceptCall:  () => ipcRenderer.send("overlay:call-accepted-fwd"),
  overlayDeclineCall: () => ipcRenderer.send("overlay:call-declined-fwd"),

  // Overlay controls its own click-through state
  overlaySetInteractive: (interactive: boolean) => ipcRenderer.send("overlay:set-interactive", interactive),
});