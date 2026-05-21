import { app, BrowserWindow, ipcMain, Menu, Notification, desktopCapturer, screen as electronScreen, Tray, nativeImage } from "electron";
import path from "path";
import { autoUpdater } from "electron-updater";

// Server URL: localhost in dev, public IP when packaged for distribution
const API_BASE = app.isPackaged
  ? "http://176.157.240.57:8000"
  : "http://localhost:8000"; // maybe remove

// Auto-updater setup

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.forceDevUpdateConfig = true;

function isNoPublishedReleaseError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const lowered = message.toLowerCase(); 

  // GitHubProvider throws this when /releases/latest does not resolve to a published release.
  return (
    lowered.includes("unable to find latest version on github") ||
    lowered.includes("releases/latest") ||
    lowered.includes("no published versions")
  );
}


let mainWin: BrowserWindow | null = null;
let overlayWin: BrowserWindow | null = null;
let tray: Tray | null = null;
let minimizeToTray = true;

const iconPath = () => {
  if (process.platform === "win32")   return path.join(__dirname, "../renderer/public/icon.ico");
  if (process.platform === "darwin")  return path.join(__dirname, "../renderer/public/icon.icns");
  return path.join(__dirname, "../renderer/public/icon.png");
};

function createWindow() {
  mainWin = new BrowserWindow({
    width: 1280,
    height: 800,
    icon: iconPath(),
    title: "PlanetForge Games Launcher",
    show: false,
    backgroundColor: "#0d0d0f",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWin.once("ready-to-show", () => mainWin?.show());

  // Minimize to tray instead of closing (if enabled)
  mainWin.on("close", (e) => {
    if (minimizeToTray) {
      e.preventDefault();
      mainWin?.hide();
    }
  });
  // When actually closed (minimize_to_tray off), quit cleanly
  mainWin.on("closed", () => {
    overlayWin?.destroy();
    overlayWin = null;
    app.quit();
  });

  if (app.isPackaged) {
    mainWin.loadFile(path.join(process.resourcesPath, "app/renderer/dist/index.html"));
  } else {
    mainWin.loadURL("http://localhost:5173");
  }
}

function createOverlayWindow() {
  const { width, height } = electronScreen.getPrimaryDisplay().workAreaSize;
  overlayWin = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    resizable: false,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  overlayWin.setIgnoreMouseEvents(true, { forward: true });
  overlayWin.setAlwaysOnTop(true, "screen-saver");
  overlayWin.once("ready-to-show", () => overlayWin?.show());
  if (app.isPackaged) {
    overlayWin.loadFile(
      path.join(process.resourcesPath, "app/renderer/dist/index.html"),
      { hash: "/overlay" }
    );
  } else {
    overlayWin.loadURL("http://localhost:5173/#/overlay");
  }
}

app.whenReady().then(() => {
    createWindow();
    createOverlayWindow();
    Menu.setApplicationMenu(null);
    createTray();
});

function createTray() {
  const img = nativeImage.createFromPath(iconPath());
  tray = new Tray(img);
  tray.setToolTip("PlanetForge Launcher");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Ouvrir PlanetForge", click: () => { mainWin?.show(); mainWin?.focus(); } },
    { type: "separator" },
    { label: "Quitter",            click: () => { minimizeToTray = false; app.quit(); } },
  ]));
  tray.on("double-click", () => { mainWin?.show(); mainWin?.focus(); });
}

// ── Native OS notification ────────────────────────────────────────────────────────
ipcMain.on("notify:show", (_event, data: { title: string; body: string }) => {
  if (Notification.isSupported()) {
    new Notification({ title: data.title, body: data.body, icon: iconPath() }).show();
  }
});

// ── Screen capture sources (for screen share picker) ─────────────────────────
ipcMain.handle("get-screen-sources", async () => {
  const sources = await desktopCapturer.getSources({
    types: ["screen", "window"],
    thumbnailSize: { width: 320, height: 180 },
    fetchWindowIcons: true,
  });
  return sources.map((s) => ({
    id:        s.id,
    name:      s.name,
    thumbnail: s.thumbnail.toDataURL(),
    appIcon:   s.appIcon ? s.appIcon.toDataURL() : null,
  }));
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ── Overlay IPC relay ─────────────────────────────────────────────────────────
ipcMain.on("overlay:show-call", (_e, data) => {
  overlayWin?.webContents.send("overlay:show-call-fwd", data);
  overlayWin?.setIgnoreMouseEvents(false);
});

ipcMain.on("overlay:hide-call", () => {
  overlayWin?.webContents.send("overlay:hide-call-fwd");
});

ipcMain.on("overlay:show-notif", (_e, data) => {
  overlayWin?.webContents.send("overlay:show-notif-fwd", data);
  overlayWin?.setIgnoreMouseEvents(false);
});

ipcMain.on("overlay:remove-notif", (_e, id) => {
  overlayWin?.webContents.send("overlay:remove-notif-fwd", id);
});

ipcMain.on("overlay:call-accepted-fwd", () => {
  mainWin?.webContents.send("overlay:call-accepted");
});

ipcMain.on("overlay:call-declined-fwd", () => {
  mainWin?.webContents.send("overlay:call-declined");
});

ipcMain.on("overlay:set-interactive", (_e, interactive: boolean) => {
  if (interactive) {
    overlayWin?.setIgnoreMouseEvents(false);
  } else {
    overlayWin?.setIgnoreMouseEvents(true, { forward: true });
  }
});

// Allow keyboard input in overlay when a message card is visible
ipcMain.on("overlay:set-focusable", (_e, focusable: boolean) => {
  overlayWin?.setFocusable(focusable);
});

// ── Message overlay ────────────────────────────────────────────────────────
ipcMain.on("overlay:show-message", (_e, data) => {
  overlayWin?.webContents.send("overlay:show-message-fwd", data);
  overlayWin?.setIgnoreMouseEvents(false);
});

// Reply typed in overlay → forward to main window so it can POST via HTTP
ipcMain.on("overlay:reply-message-fwd", (_e, data) => {
  mainWin?.webContents.send("overlay:reply-message", data);
});

// ── Achievement overlay ────────────────────────────────────────────
ipcMain.on("overlay:show-achievement", (_e, data) => {
  overlayWin?.webContents.send("overlay:show-achievement-fwd", data);
  overlayWin?.setIgnoreMouseEvents(false);
});

// ── Friend-request overlay ───────────────────────────────────────
ipcMain.on("overlay:show-friend-request", (_e, data) => {
  overlayWin?.webContents.send("overlay:show-friend-request-fwd", data);
  overlayWin?.setIgnoreMouseEvents(false);
});

// Overlay friend-request buttons → forward answer to main window
ipcMain.on("overlay:accept-request-fwd", (_e, data) => {
  mainWin?.webContents.send("overlay:accept-request", data);
});
ipcMain.on("overlay:decline-request-fwd", (_e, data) => {
  mainWin?.webContents.send("overlay:decline-request", data);
});

// ── Launcher settings ──────────────────────────────────────────────────────
ipcMain.on("app:set-auto-launch", (_e, enabled: boolean) => {
  app.setLoginItemSettings({ openAtLogin: enabled });
});

ipcMain.on("app:set-minimize-to-tray", (_e, enabled: boolean) => {
  minimizeToTray = enabled;
});

ipcMain.on("app:set-auto-update", (_e, enabled: boolean) => {
  autoUpdater.autoDownload = enabled;
});

ipcMain.handle("auth:login", async (_event, data: { email: string; password: string }) => {
  try {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const json = await response.json();
    if (!response.ok) return { ok: false, error: json.detail ?? "Unauthorized" };
    return { ok: true, data: json };

  } catch {
    return { ok: false, error: "Server unreachable" };
  }
});

ipcMain.handle("auth:register", async (_event, data) => {
  try {
    const response = await fetch(`${API_BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const json = await response.json();
    if (!response.ok) return { ok: false, error: json.detail ?? "Registration failed" };
    return { ok: true, data: json };

  } catch {
    return { ok: false, error: "Server unreachable" };
  }
});

ipcMain.handle("auth:refresh", async (_event, data: { refresh_token: string }) => {
  try {
    const response = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const json = await response.json();
    if (!response.ok) return { ok: false, error: json.detail ?? "Refresh failed" };
    return { ok: true, data: json };

  } catch {
    return { ok: false, error: "Server unreachable" };
  }
});


// ── isUpdateAvailable ────────────────────────────────────────────────────────
ipcMain.handle("update:check", async () => {
  try {
    const result = await autoUpdater.checkForUpdates();
    const current = app.getVersion();

    if (!result) {
      return {
        available: false,
        currentVersion: current,
        latestVersion: current,
        releaseNotes: null,
        error: "No update metadata was returned by electron-updater.",
      };
    }

    const latest = result.updateInfo.version;
    const available = latest !== current;

    return {
      available,
      currentVersion: current,
      latestVersion: latest,
      releaseNotes: result.updateInfo.releaseNotes ?? null,
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (isNoPublishedReleaseError(error)) {
      console.info("No published release found on GitHub; skipping update banner.");
      const current = app.getVersion();
      return {
        available: false,
        currentVersion: current,
        latestVersion: current,
        releaseNotes: null,
        error: null,
      };
    }

    console.error("Update check failed:", message);

    return {
      available: false,
      currentVersion: app.getVersion(),
      latestVersion: app.getVersion(),
      releaseNotes: null,
      error: message,
    };
  }
});

// ── installUpdate ────────────────────────────────────────────────────────────
ipcMain.handle("update:download-and-install", async (_event) => {
  return new Promise((resolve, reject) => {
    autoUpdater.on("download-progress", (progress) => {
      _event.sender.send("update:progress", Math.round(progress.percent));
    });

    autoUpdater.on("update-downloaded", () => {
        autoUpdater.quitAndInstall();
        resolve(true);
    });

    autoUpdater.on("error", (err) => {
      reject(err.message);
    });

    autoUpdater.downloadUpdate();
  });
});