import { app, BrowserWindow, Tray ,globalShortcut} from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { WIN_H, WIN_W } from "./constants";
import { createTray, getTargetPosition, handleBlur, toggleWindow } from "./utils/electron.utils";


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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let tray: Tray | null = null; // keep a reference so the tray icon isn't garbage collected
let isQuitting = false;

function createWindow() {
  const pos = getTargetPosition();

  const w = new BrowserWindow({
    type: "dock", // keeps the window out of the taskbar on GNOME/Mutter
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
  win = w;

  w.on("blur", () => handleBlur(w));

  w.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault(); // Don't destroy the window
      w.hide(); // Hide it to the background instead
    }
  });

  w.webContents.on("did-finish-load", () => {
    w.webContents.send("main-process-message", new Date().toLocaleString());
  });

  if (VITE_DEV_SERVER_URL) {
    w.loadURL(VITE_DEV_SERVER_URL);
  } else {
    w.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
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

  tray = createTray(
    path.join(__dirname, "../public/trayIcon.png"),
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