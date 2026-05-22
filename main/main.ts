import { app, BrowserWindow, ipcMain, Menu, Notification, desktopCapturer, screen as electronScreen, Tray, nativeImage, dialog } from "electron";
import path from "path";
import fs from "fs";
import { once } from "events";
import { spawn, type ChildProcess } from "child_process";
import yauzl from "yauzl";
import { autoUpdater } from "electron-updater";

const DEFAULT_DEV_API_BASE = "http://localhost:8000";
const DEFAULT_PROD_API_BASE = "http://176.157.240.57:8000";

function resolveApiBase(): string {
  const fallback = app.isPackaged ? DEFAULT_PROD_API_BASE : DEFAULT_DEV_API_BASE;
  const raw = (process.env.PLANETFORGE_API_URL ?? fallback).trim();
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Unsupported API protocol");
    }
    return raw.replace(/\/$/, "");
  } catch {
    return fallback;
  }
}

const API_BASE = resolveApiBase();
const APP_ORIGIN_DEV = "http://localhost:5173";
let isUpdateDownloadInProgress = false;

// Auto-updater setup

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.forceDevUpdateConfig = !app.isPackaged;

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
const runningGames = new Map<number, ChildProcess>();

type InstallProgress = {
  stage: "idle" | "downloading" | "extracting" | "finalizing" | "completed" | "failed";
  gameId: number;
  gameTitle: string;
  percent: number;
  downloadedBytes: number;
  totalBytes: number;
  speedMbps: number;
  drops: number;
  message?: string;
};

function sendInstallProgress(target: Electron.WebContents, p: InstallProgress) {
  target.send("game:install-progress", p);
}

function safeFolderName(input: string): string {
  const cleaned = input.replace(/[<>:"/\\|?*\x00-\x1F]/g, "").trim();
  return cleaned || "Game";
}

function normalizePath(inputPath: string): string {
  return path.resolve(inputPath);
}

function isSubPath(baseDir: string, targetPath: string): boolean {
  const base = normalizePath(baseDir);
  const target = normalizePath(targetPath);
  return target === base || target.startsWith(`${base}${path.sep}`);
}

function isUnsafeDeleteTarget(targetPath: string): boolean {
  const resolved = normalizePath(targetPath);
  const parsed = path.parse(resolved);
  const isRoot = resolved === parsed.root;
  const home = normalizePath(app.getPath("home"));
  const docs = normalizePath(app.getPath("documents"));
  const downloads = normalizePath(app.getPath("downloads"));

  return (
    isRoot ||
    resolved === home ||
    resolved === docs ||
    resolved === downloads
  );
}

function installMarkerPath(installDir: string): string {
  return path.join(installDir, ".planetforge-install.json");
}

async function writeInstallMarker(installDir: string, gameId: number): Promise<void> {
  const marker = {
    gameId,
    installedAt: new Date().toISOString(),
  };
  await fs.promises.writeFile(installMarkerPath(installDir), JSON.stringify(marker), "utf-8");
}

async function validateInstallMarker(installDir: string, gameId: number): Promise<boolean> {
  try {
    const raw = await fs.promises.readFile(installMarkerPath(installDir), "utf-8");
    const parsed = JSON.parse(raw) as { gameId?: number };
    return parsed.gameId === gameId;
  } catch {
    return false;
  }
}

function isTrustedAppUrl(url: string): boolean {
  if (app.isPackaged) {
    return url.startsWith("file://");
  }
  return url.startsWith(APP_ORIGIN_DEV);
}

function hardenWindow(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event, url) => {
    if (!isTrustedAppUrl(url)) {
      event.preventDefault();
    }
  });
  win.webContents.on("will-attach-webview", (event) => {
    event.preventDefault();
  });
}

async function notifyPlayingStatus(token: string, gameName: string | null): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/users/me/playing`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ game_name: gameName }),
    });
  } catch {
    // Non-blocking: launching the game must not fail if presence update fails.
  }
}

function normalizeRelativeExecutable(executablePath: string): string {
  return executablePath.replace(/[\\/]+/g, path.sep);
}

async function findExecutableRecursively(baseDir: string): Promise<string | null> {
  const stack = [baseDir];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;

    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile()) {
        const isWindowsExe = process.platform === "win32" && entry.name.toLowerCase().endsWith(".exe");
        const isUnixExecutable = process.platform !== "win32" && path.extname(entry.name) === "";
        if (isWindowsExe || isUnixExecutable) return full;
      }
    }
  }
  return null;
}

async function resolveExecutablePath(installPath: string, executablePath?: string | null): Promise<string> {
  if (executablePath && executablePath.trim()) {
    const cleaned = normalizeRelativeExecutable(executablePath.trim());
    const candidate = path.isAbsolute(cleaned) ? cleaned : path.join(installPath, cleaned);
    if (!isSubPath(installPath, candidate)) {
      throw new Error("Executable path escapes install directory");
    }
    await fs.promises.access(candidate, fs.constants.F_OK);
    return candidate;
  }

  const discovered = await findExecutableRecursively(installPath);
  if (!discovered) {
    throw new Error("Executable not found in install folder");
  }
  return discovered;
}

function openZip(filePath: string): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.open(filePath, { lazyEntries: true, autoClose: false, decodeStrings: true }, (err, zipFile) => {
      if (err || !zipFile) {
        reject(err ?? new Error("Unable to open archive"));
        return;
      }
      resolve(zipFile);
    });
  });
}

async function extractZipFile(filePath: string, installDir: string, onProgress: (done: number, total: number) => void): Promise<void> {
  const zipFile = await openZip(filePath);
  try {
    const totalEntries = zipFile.entryCount || 1;
    let processedEntries = 0;

    await new Promise<void>((resolve, reject) => {
      const cleanup = (error?: Error) => {
        zipFile.close();
        if (error) reject(error); else resolve();
      };

      zipFile.readEntry();
      zipFile.on("entry", (entry) => {
        processedEntries += 1;

        const entryPath = path.normalize(entry.fileName);
        if (path.isAbsolute(entryPath)) {
          cleanup(new Error(`Invalid archive entry path: ${entry.fileName}`));
          return;
        }
        const targetPath = path.join(installDir, entryPath);
        if (!isSubPath(installDir, targetPath)) {
          cleanup(new Error(`Blocked unsafe archive entry: ${entry.fileName}`));
          return;
        }

        if (/\/$/.test(entry.fileName)) {
          fs.promises.mkdir(targetPath, { recursive: true })
            .then(() => {
              onProgress(processedEntries, totalEntries);
              zipFile.readEntry();
            })
            .catch((error) => cleanup(error instanceof Error ? error : new Error(String(error))));
          return;
        }

        const parentDir = path.dirname(targetPath);
        fs.promises.mkdir(parentDir, { recursive: true })
          .then(() => new Promise<void>((entryResolve, entryReject) => {
            zipFile.openReadStream(entry, (err, readStream) => {
              if (err || !readStream) {
                entryReject(err ?? new Error(`Unable to read ${entry.fileName}`));
                return;
              }

              const writeStream = fs.createWriteStream(targetPath);
              readStream.on("error", entryReject);
              writeStream.on("error", entryReject);
              writeStream.on("finish", () => entryResolve());
              readStream.pipe(writeStream);
            });
          }))
          .then(() => {
            onProgress(processedEntries, totalEntries);
            zipFile.readEntry();
          })
          .catch((error) => cleanup(error instanceof Error ? error : new Error(String(error))));
      });

      zipFile.on("end", () => cleanup());
      zipFile.on("error", (error) => cleanup(error instanceof Error ? error : new Error(String(error))));
    });
  } finally {
    zipFile.close();
  }
}

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
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: !app.isPackaged,
    },
  });

  hardenWindow(mainWin);

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
    mainWin.loadURL(APP_ORIGIN_DEV);
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
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: !app.isPackaged,
    },
  });
  hardenWindow(overlayWin);
  overlayWin.setIgnoreMouseEvents(true, { forward: true });
  overlayWin.setAlwaysOnTop(true, "screen-saver");
  overlayWin.once("ready-to-show", () => overlayWin?.show());
  if (app.isPackaged) {
    overlayWin.loadFile(
      path.join(process.resourcesPath, "app/renderer/dist/index.html"),
      { hash: "/overlay" }
    );
  } else {
    overlayWin.loadURL(`${APP_ORIGIN_DEV}/#/overlay`);
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
  if (isUpdateDownloadInProgress) {
    throw new Error("Une mise a jour est deja en cours de telechargement.");
  }

  return new Promise((resolve, reject) => {
    isUpdateDownloadInProgress = true;

    const cleanup = () => {
      autoUpdater.removeListener("download-progress", onProgress);
      autoUpdater.removeListener("update-downloaded", onDownloaded);
      autoUpdater.removeListener("error", onError);
      isUpdateDownloadInProgress = false;
    };

    const onProgress = (progress: { percent: number }) => {
      _event.sender.send("update:progress", Math.round(progress.percent));
    };

    const onDownloaded = () => {
      cleanup();
      autoUpdater.quitAndInstall();
      resolve(true);
    };

    const onError = (err: Error) => {
      cleanup();
      reject(err.message);
    };

    autoUpdater.on("download-progress", onProgress);
    autoUpdater.once("update-downloaded", onDownloaded);
    autoUpdater.once("error", onError);

    autoUpdater.downloadUpdate().catch((err: unknown) => {
      cleanup();
      reject(err instanceof Error ? err.message : String(err));
    });
  });
});

ipcMain.handle("game:install", async (event, payload: { gameId: number; gameTitle: string; token: string; version?: string | null }) => {
  const { gameId, gameTitle, token, version } = payload;
  const wc = event.sender;

  try {
    const openDialogOptions: Electron.OpenDialogOptions = {
      title: `Choisir le dossier d'installation pour ${gameTitle}`,
      properties: ["openDirectory", "createDirectory"],
    };
    const pick = mainWin
      ? await dialog.showOpenDialog(mainWin, openDialogOptions)
      : await dialog.showOpenDialog(openDialogOptions);
    if (pick.canceled || pick.filePaths.length === 0) {
      return { success: false, cancelled: true };
    }

    const baseDir = pick.filePaths[0];
    const installDir = path.join(baseDir, safeFolderName(gameTitle));
    await fs.promises.mkdir(installDir, { recursive: true });

    const stagingDir = path.join(baseDir, ".planetforge-staging");
    await fs.promises.mkdir(stagingDir, { recursive: true });

    const tmpZipPath = path.join(stagingDir, `planetforge-${gameId}-${Date.now()}.zip`);
    const response = await fetch(`${API_BASE}/api/games/${gameId}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok || !response.body) {
      const txt = await response.text().catch(() => "");
      throw new Error(txt || "Download failed");
    }

    const totalBytes = Number(response.headers.get("content-length") ?? "0");
    const out = fs.createWriteStream(tmpZipPath);
    const reader = response.body.getReader();
    let downloadedBytes = 0;
    let lastBytes = 0;
    let speedMbps = 0;
    let prevSpeed = 0;
    let drops = 0;
    let lastTick = Date.now();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      downloadedBytes += value.length;
      if (!out.write(Buffer.from(value))) {
        await once(out, "drain");
      }

      const now = Date.now();
      const elapsed = (now - lastTick) / 1000;
      if (elapsed >= 0.8) {
        speedMbps = ((downloadedBytes - lastBytes) * 8) / (elapsed * 1_000_000);
        if (prevSpeed > 0 && speedMbps < prevSpeed * 0.7) drops += 1;
        prevSpeed = speedMbps;
        lastBytes = downloadedBytes;
        lastTick = now;

        sendInstallProgress(wc, {
          stage: "downloading",
          gameId,
          gameTitle,
          percent: totalBytes > 0 ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)) : 0,
          downloadedBytes,
          totalBytes,
          speedMbps,
          drops,
        });
      }
    }

    out.end();
    await once(out, "finish");

    sendInstallProgress(wc, {
      stage: "extracting",
      gameId,
      gameTitle,
      percent: 0,
      downloadedBytes,
      totalBytes: totalBytes || downloadedBytes,
      speedMbps,
      drops,
      message: "Extraction du build...",
    });

    await extractZipFile(tmpZipPath, installDir, (done, total) => {
      if (done % 5 === 0 || done === total) {
        sendInstallProgress(wc, {
          stage: "extracting",
          gameId,
          gameTitle,
          percent: Math.round((done / total) * 100),
          downloadedBytes,
          totalBytes: totalBytes || downloadedBytes,
          speedMbps,
          drops,
        });
      }
    });

    await writeInstallMarker(installDir, gameId);

    await fs.promises.unlink(tmpZipPath).catch(() => undefined);

    const params = new URLSearchParams({
      is_installed: "true",
      install_path: installDir,
      installed_version: version ?? "",
    });

    await fetch(`${API_BASE}/api/games/${gameId}/install-status?${params.toString()}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });

    sendInstallProgress(wc, {
      stage: "completed",
      gameId,
      gameTitle,
      percent: 100,
      downloadedBytes,
      totalBytes: totalBytes || downloadedBytes,
      speedMbps,
      drops,
      message: "Installation terminée",
    });

    return { success: true, installPath: installDir };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendInstallProgress(wc, {
      stage: "failed",
      gameId,
      gameTitle,
      percent: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      speedMbps: 0,
      drops: 0,
      message,
    });
    return { success: false, error: message };
  }
});

ipcMain.handle("game:play", async (_event, payload: {
  gameId: number;
  gameTitle: string;
  token: string;
  installPath: string;
  executablePath?: string | null;
}) => {
  const { gameId, gameTitle, token, installPath, executablePath } = payload;

  try {
    if (runningGames.has(gameId)) {
      return { success: false, error: "Le jeu est deja en cours d'execution." };
    }

    const resolvedInstallPath = normalizePath(installPath);
    await fs.promises.access(resolvedInstallPath, fs.constants.F_OK);

    const markerValid = await validateInstallMarker(resolvedInstallPath, gameId);
    if (!markerValid) {
      return { success: false, error: "Installation invalide ou non verifiee pour ce jeu." };
    }

    const resolvedExe = await resolveExecutablePath(resolvedInstallPath, executablePath);

    const child = spawn(resolvedExe, [], {
      cwd: path.dirname(resolvedExe),
      detached: false,
      stdio: "ignore",
      windowsHide: false,
    });

    runningGames.set(gameId, child);
    child.unref();

    await notifyPlayingStatus(token, gameTitle);

    const clearPlaying = async () => {
      const current = runningGames.get(gameId);
      if (current === child) {
        runningGames.delete(gameId);
        await notifyPlayingStatus(token, null);
      }
    };

    child.once("exit", () => {
      void clearPlaying();
    });
    child.once("error", () => {
      void clearPlaying();
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle("game:uninstall", async (_event, payload: {
  gameId: number;
  token: string;
  installPath: string;
}) => {
  const { gameId, token, installPath } = payload;

  try {
    if (runningGames.has(gameId)) {
      return { success: false, error: "Ferme le jeu avant de le desinstaller." };
    }

    const resolvedInstallPath = normalizePath(installPath);
    if (isUnsafeDeleteTarget(resolvedInstallPath)) {
      return { success: false, error: "Chemin de desinstallation refuse pour securite." };
    }

    const markerValid = await validateInstallMarker(resolvedInstallPath, gameId);
    if (!markerValid) {
      return { success: false, error: "Installation invalide ou non verifiee pour ce jeu." };
    }

    await fs.promises.rm(resolvedInstallPath, { recursive: true, force: true });

    const params = new URLSearchParams({
      is_installed: "false",
      install_path: "",
      installed_version: "",
    });

    await fetch(`${API_BASE}/api/games/${gameId}/install-status?${params.toString()}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});