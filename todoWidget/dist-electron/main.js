import { app, BrowserWindow, nativeImage, Tray, Menu, screen } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "..");
if (process.platform === "linux") {
  app.commandLine.appendSwitch("use-gl", "angle");
  app.commandLine.appendSwitch("use-angle", "swiftshader");
  app.commandLine.appendSwitch("in-process-gpu");
}
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win = null;
let tray = null;
let isQuitting = false;
let hideTimer = null;
let settleTimer = null;
let lastShow = 0;
let hasSettledOnce = false;
const WIN_W = 400;
const WIN_H = 700;
const MARGIN_RIGHT = 0;
const MARGIN_BOTTOM = 0;
const PANEL_OFFSET = 0;
const HIDE_ANIMATION_MS = 250;
function getTargetPosition() {
  const { x, y, width, height } = screen.getPrimaryDisplay().workArea;
  return {
    x: Math.round(x + width - WIN_W - MARGIN_RIGHT),
    y: Math.round(y + height - WIN_H - MARGIN_BOTTOM - PANEL_OFFSET)
  };
}
function placeWindow() {
  if (!win || win.isDestroyed()) return;
  const { x, y } = getTargetPosition();
  win.setBounds({ x, y, width: WIN_W, height: WIN_H });
}
function settlePosition(onDone) {
  if (settleTimer) clearInterval(settleTimer);
  const MAX_TRIES = 100;
  const NEEDED_OK = 6;
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
      onDone == null ? void 0 : onDone();
    }
  }, 10);
}
function hideWindow() {
  if (!win || !win.isVisible() || hideTimer) return;
  win.webContents.send("animate-close");
  hideTimer = setTimeout(() => {
    hideTimer = null;
    win == null ? void 0 : win.hide();
  }, HIDE_ANIMATION_MS);
}
function showWindow() {
  if (!win) return;
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
    win.webContents.send("animate-open");
    settlePosition();
  } else {
    settlePosition(() => win == null ? void 0 : win.webContents.send("animate-open"));
  }
}
function toggleWindow() {
  if (win == null ? void 0 : win.isVisible()) hideWindow();
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
    show: false,
    // start hidden, live in the tray
    frame: false,
    useContentSize: true,
    resizable: false,
    hasShadow: false,
    transparent: true,
    backgroundColor: "#00000000",
    focusable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs")
    }
  });
  win.on("blur", () => {
    if (Date.now() - lastShow > 250) hideWindow();
  });
  win.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win == null ? void 0 : win.hide();
    }
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
function createTray() {
  const iconPath = path.join(__dirname$1, "../public/trayIcon.png");
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
      }
    }
  ]);
  tray.setContextMenu(contextMenu);
  tray.on("click", toggleWindow);
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
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
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
