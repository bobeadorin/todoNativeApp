import { app, BrowserWindow, screen, Tray, Menu, nativeImage } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.APP_ROOT = path.join(__dirname, "..");

// Wayland doesn't let apps position their own windows, so the app must run on
// XWayland. The platform flag (--ozone-platform=x11) is passed at launch from
// vite.config.ts in dev, and from the .desktop file's Exec= line when packaged.
// It can't be set from here because Chromium picks its backend before this runs.
if (process.platform === "linux") {
  app.commandLine.appendSwitch("use-gl", "angle");
  app.commandLine.appendSwitch("use-angle", "swiftshader");
  app.commandLine.appendSwitch("in-process-gpu");
}

export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

let hideTimer: NodeJS.Timeout | null = null;
let settleTimer: NodeJS.Timeout | null = null;
let lastShow = 0;
let hasSettledOnce = false;

const WIN_W = 400;
const WIN_H = 700;
const MARGIN_RIGHT = 0;
const MARGIN_BOTTOM = 0;
const PANEL_OFFSET = 0; // fine-tuning for the distance above the panel
const HIDE_ANIMATION_MS = 250; // Must match the CSS transition duration

function getTargetPosition() {
  const { x, y, width, height } = screen.getPrimaryDisplay().workArea;
  return {
    x: Math.round(x + width - WIN_W - MARGIN_RIGHT),
    y: Math.round(y + height - WIN_H - MARGIN_BOTTOM - PANEL_OFFSET),
  };
}

function placeWindow() {
  if (!win || win.isDestroyed()) return;
  const { x, y } = getTargetPosition();
  win.setBounds({ x, y, width: WIN_W, height: WIN_H });
}

/**
 * Mutter re-centers a window the first time it is shown. Keep re-applying the
 * target position until it sticks, then call onDone.
 */
function settlePosition(onDone?: () => void) {
  if (settleTimer) clearInterval(settleTimer);

  const MAX_TRIES = 100; // 100 * 10ms = 1s
  const NEEDED_OK = 6; // correct 6 checks in a row (~60ms)
  let tries = 0;
  let okStreak = 0;

  settleTimer = setInterval(() => {
    if (!win || win.isDestroyed()) {
      if (settleTimer) clearInterval(settleTimer);
      return;
    }

    tries++;
    const target = getTargetPosition();
    const b = win.getBounds();

    if (b.x === target.x && b.y === target.y) {
      okStreak++;
    } else {
      okStreak = 0;
      placeWindow();
    }

    if (okStreak >= NEEDED_OK || tries >= MAX_TRIES) {
      if (settleTimer) clearInterval(settleTimer);
      hasSettledOnce = true;
      onDone?.();
    }
  }, 10);
}

function hideWindow() {
  if (!win || !win.isVisible() || hideTimer) return;
  win.webContents.send("animate-close");
  hideTimer = setTimeout(() => {
    hideTimer = null;
    win?.hide();
  }, HIDE_ANIMATION_MS);
}

function showWindow() {
  if (!win) return;

  // Cancel any pending hide so it can't hide the window right after we show it
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }

  lastShow = Date.now();
  placeWindow();
  win.setAlwaysOnTop(true, "screen-saver");
  win.show();
  win.setSkipTaskbar(true);
  win.focus();

  if (hasSettledOnce) {
    // Mutter remembers the position after the first show: animate right away
    win.webContents.send("animate-open");
    settlePosition();
  } else {
    // First show: wait until the position sticks so the jump isn't visible
    settlePosition(() => win?.webContents.send("animate-open"));
  }
}

function toggleWindow() {
  if (win?.isVisible()) hideWindow();
  else showWindow();
}

function createWindow() {
  const pos = getTargetPosition();

  win = new BrowserWindow({
    type: "dock",
    width: WIN_W,
    height: WIN_H,
    x: pos.x,
    y: pos.y,
    show: false, // start hidden, live in the tray
    frame: false,
    useContentSize: true,
    resizable: false,
    hasShadow: false,
    transparent: true,
    backgroundColor: "#00000000",
    focusable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    icon: path.join(process.env.VITE_PUBLIC!, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
    },
  });

  // Ignore blur events that arrive right after showing (focus bounce from the tray menu)
  win.on("blur", () => {
    if (Date.now() - lastShow > 250) hideWindow();
  });

  win.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault(); // Don't destroy the window
      win?.hide(); // Hide it to the background instead
    }
  });

  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}

function createTray() {
  const iconPath = path.join(__dirname, "../public/trayIcon.png");
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);
  tray.setToolTip("My Custom Electron App");

  const contextMenu = Menu.buildFromTemplate([
    { label: "Show / Hide", click: toggleWindow },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on("click", toggleWindow);
}

// Quit when all windows are closed, except on macOS.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});

app.on("activate", () => {
  // On macOS, re-create a window when the dock icon is clicked and none are open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.whenReady().then(() => {
  createWindow();
  createTray();
});