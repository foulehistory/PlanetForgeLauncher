import { app, BrowserWindow, ipcMain, Menu } from "electron";
import path from "path";
import { autoUpdater } from "electron-updater";

// Auto-updater setup

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;


const iconPath = () => {
  if (process.platform === "win32")   return path.join(__dirname, "../renderer/public/icon.ico");
  if (process.platform === "darwin")  return path.join(__dirname, "../renderer/public/icon.icns");
  return path.join(__dirname, "../renderer/public/icon.png");
};

function createWindow() {
  console.log("icon path: ", iconPath());
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    icon: iconPath(),
    title: "PlanetForge Games Launcher",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false, 
    },
  });

  if (app.isPackaged) {
    win.loadFile(path.join(process.resourcesPath, "app/renderer/dist/index.html"));
  } else {
    win.loadURL("http://localhost:5173");
  }
}

app.whenReady().then(() => {
    createWindow();
    Menu.setApplicationMenu(null);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("auth:login", async (_event, data: { email: string; password: string }) => {
  try {
    const response = await fetch("http://localhost:8000/api/auth/login", {
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
    const response = await fetch("http://localhost:8000/api/auth/register", {
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


// ── isUpdateAvailable ────────────────────────────────────────────────────────
ipcMain.handle("update:check", async () => {
  try 
  {
    const result = await autoUpdater.checkForUpdates();
    if (!result) return { available: false };

    const current = app.getVersion();
    const latest = result.updateInfo.version;
    const available = latest !== current;

    return {
      available,
      currentVersion: current,
      latestVersion: latest,
      releaseNotes: result.updateInfo.releaseNotes ?? null,
    };
  } catch {
    return { available: false };
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