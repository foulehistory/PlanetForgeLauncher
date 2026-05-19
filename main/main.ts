import { app, BrowserWindow, ipcMain, Menu } from "electron";
import path from "path";
import { autoUpdater } from "electron-updater";

// Server URL: localhost in dev, public IP when packaged for distribution
const API_BASE = app.isPackaged
  ? "http://176.157.240.57:8000"
  : "http://localhost:8000";

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