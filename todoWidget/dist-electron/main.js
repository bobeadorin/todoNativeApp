import { nativeImage, Tray, Menu, screen, app, BrowserWindow, globalShortcut } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
const WIN_W = 400;
const WIN_H = 700;
const MARGIN_RIGHT = 12;
const MARGIN_BOTTOM = 0;
const PANEL_OFFSET = 0;
const HIDE_ANIMATION_MS = 250;
let hideTimer = null;
let settleTimer = null;
let hasSettledOnce = false;
let lastShow = 0;
function getTargetPosition() {
  const { x, y, width, height } = screen.getPrimaryDisplay().workArea;
  return {
    x: Math.round(x + width - WIN_W - MARGIN_RIGHT),
    y: Math.round(y + height - WIN_H - MARGIN_BOTTOM - PANEL_OFFSET)
  };
}
function placeWindow(win2) {
  if (win2.isDestroyed()) return;
  const { x, y } = getTargetPosition();
  win2.setBounds({ x, y, width: WIN_W, height: WIN_H });
}
function settlePosition(win2, onDone) {
  if (settleTimer) clearInterval(settleTimer);
  const MAX_TRIES = 100;
  const NEEDED_OK = 6;
  let tries = 0;
  let okStreak = 0;
  settleTimer = setInterval(() => {
    if (win2.isDestroyed()) {
      if (settleTimer) clearInterval(settleTimer);
      return;
    }
    tries++;
    const target = getTargetPosition();
    const b = win2.getBounds();
    if (b.x === target.x && b.y === target.y) {
      okStreak++;
    } else {
      okStreak = 0;
      placeWindow(win2);
    }
    if (okStreak >= NEEDED_OK || tries >= MAX_TRIES) {
      if (settleTimer) clearInterval(settleTimer);
      hasSettledOnce = true;
      onDone == null ? void 0 : onDone();
    }
  }, 10);
}
function hideWindow(win2) {
  if (win2.isDestroyed() || !win2.isVisible() || hideTimer) return;
  win2.webContents.send("animate-close");
  hideTimer = setTimeout(() => {
    hideTimer = null;
    if (!win2.isDestroyed()) win2.hide();
  }, HIDE_ANIMATION_MS);
}
function showWindow(win2) {
  if (win2.isDestroyed()) return;
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  lastShow = Date.now();
  placeWindow(win2);
  win2.setAlwaysOnTop(true, "screen-saver");
  win2.show();
  win2.setSkipTaskbar(true);
  win2.focus();
  if (hasSettledOnce) {
    win2.webContents.send("animate-open");
    settlePosition(win2);
  } else {
    settlePosition(win2, () => {
      if (!win2.isDestroyed()) win2.webContents.send("animate-open");
    });
  }
}
function toggleWindow(win2) {
  if (win2.isVisible()) hideWindow(win2);
  else showWindow(win2);
}
function handleBlur(win2) {
  if (Date.now() - lastShow > 250) hideWindow(win2);
}
function createTray(iconPath, onToggle, onQuit) {
  const icon = nativeImage.createFromPath(iconPath);
  const tray = new Tray(icon);
  tray.setToolTip("My Custom Electron App");
  const contextMenu = Menu.buildFromTemplate([
    { label: "Show / Hide", click: onToggle },
    { type: "separator" },
    { label: "Quit", click: onQuit }
  ]);
  tray.setContextMenu(contextMenu);
  tray.on("click", onToggle);
  return tray;
}
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
let isQuitting = false;
function createWindow() {
  const pos = getTargetPosition();
  const w = new BrowserWindow({
    type: "dock",
    // keeps the window out of the taskbar on GNOME/Mutter
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
  win = w;
  w.on("blur", () => handleBlur(w));
  w.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      w.hide();
    }
  });
  w.webContents.on("did-finish-load", () => {
    w.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    w.loadURL(VITE_DEV_SERVER_URL);
  } else {
    w.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
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
  createTray(
    path.join(__dirname$1, "../public/trayIcon.png"),
    () => {
      if (win) toggleWindow(win);
    },
    () => {
      isQuitting = true;
      app.quit();
    }
  );
  const ok = globalShortcut.register("Alt+Shift+T", () => {
    if (win) toggleWindow(win);
  });
  console.log("global shortcut registered:", ok);
  app.on("will-quit", () => globalShortcut.unregisterAll());
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
